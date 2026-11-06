import { app, ipcMain, shell, BrowserWindow, type WebContents } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PANE_COLORS, DEFAULT_SETTINGS, normalizeSettings, type PaneColor } from '@shared/settings'
import {
  APP_WINDOW_ID,
  LAYOUTS,
  type LayoutId,
  type PersistedWorkspaces,
  type StoreData,
  type StoreKey,
  type WidgetBounds
} from '@shared/data'
import { IPC } from '@shared/ipc'

const EMPTY: Omit<StoreData, 'settings'> = {
  workspaces: null,
  widgetBounds: {},
  paneCwds: {},
  windowBounds: {}
}

let data: StoreData = { settings: DEFAULT_SETTINGS, ...EMPTY }
let file = ''
let timer: NodeJS.Timeout | null = null
let dirty = false

const listeners = new Map<StoreKey, Array<(value: unknown) => void>>()

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown, max: number, fallback = ''): string =>
  typeof v === 'string' ? v.slice(0, max) : fallback

function sanitizeWorkspaces(v: unknown): PersistedWorkspaces | null {
  if (!isObj(v) || !Array.isArray(v.workspaces)) return null
  const workspaces = v.workspaces.filter(isObj).map((w) => ({
    id: str(w.id, 64, crypto.randomUUID()),
    name: str(w.name, 80, 'Workspace'),
    windowId:
      typeof w.windowId === 'string' && APP_WINDOW_ID.test(w.windowId) ? w.windowId : 'main',
    parked: w.parked === true,
    folder: str(w.folder, 1000),
    layout: LAYOUTS.includes(w.layout as LayoutId) ? (w.layout as LayoutId) : 'auto',
    split: typeof w.split === 'number' && w.split >= 0.2 && w.split <= 0.8 ? w.split : null,
    panes: (Array.isArray(w.panes) ? w.panes : []).filter(isObj).map((p) => ({
      id: str(p.id, 64, crypto.randomUUID()),
      name: str(p.name, 80),
      note: str(p.note, 1000),
      color: PANE_COLORS.includes(p.color as PaneColor) ? (p.color as PaneColor) : null
    })),
    activePaneId: typeof w.activePaneId === 'string' ? w.activePaneId : null
  }))
  if (workspaces.length === 0) return null

  const activeByWindow: Record<string, string> = {}
  const rawActive = isObj(v.activeByWindow) ? v.activeByWindow : {}
  for (const [win, id] of Object.entries(rawActive)) {
    if (workspaces.some((w) => w.id === id && w.windowId === win))
      activeByWindow[win] = id as string
  }
  // Files from before windows existed had a single active workspace.
  const legacy = v.activeWorkspaceId
  if (!activeByWindow.main && workspaces.some((w) => w.id === legacy && w.windowId === 'main')) {
    activeByWindow.main = legacy as string
  }
  return { workspaces, activeByWindow }
}

function sanitizeStringMap(v: unknown, max: number): Record<string, string> {
  const out: Record<string, string> = {}
  if (!isObj(v)) return out
  for (const [k, val] of Object.entries(v))
    if (typeof val === 'string') out[k.slice(0, 64)] = val.slice(0, max)
  return out
}

function sanitizeBounds(v: unknown): Record<string, WidgetBounds> {
  const out: Record<string, WidgetBounds> = {}
  if (!isObj(v)) return out
  for (const [key, b] of Object.entries(v)) {
    if (!isObj(b)) continue
    const { x, y, width, height } = b
    if ([x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      out[key] = { x, y, width, height } as WidgetBounds
    }
  }
  return out
}

export function initStore(): void {
  file = join(app.getPath('userData'), 'sdterm.json')
  try {
    const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
    const o = isObj(raw) ? raw : {}
    data = {
      settings: normalizeSettings(o.settings),
      workspaces: sanitizeWorkspaces(o.workspaces),
      widgetBounds: sanitizeBounds(o.widgetBounds),
      paneCwds: sanitizeStringMap(o.paneCwds, 1000),
      windowBounds: sanitizeBounds(o.windowBounds)
    }
  } catch {
    // First run, or an unreadable file: start from defaults. The bad file is overwritten
    // on the next save.
    data = { settings: DEFAULT_SETTINGS, ...EMPTY }
  }
}

export const getStore = (): StoreData => data
export const storePath = (): string => file

function writeNow(): void {
  if (!dirty) return
  dirty = false
  try {
    mkdirSync(dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, JSON.stringify(data, null, 2))
    renameSync(tmp, file) // atomic: a crash mid-write never leaves a half file
  } catch (err) {
    console.error('[store] could not save', err)
  }
}

export function flushStore(): void {
  if (timer) clearTimeout(timer)
  timer = null
  writeNow()
}

export function onStoreChange<K extends StoreKey>(key: K, cb: (value: StoreData[K]) => void): void {
  const list = listeners.get(key) ?? []
  list.push(cb as (value: unknown) => void)
  listeners.set(key, list)
}

/** `origin` is the window that made the change; it already has the value, so it is skipped. */
export function setStoreValue<K extends StoreKey>(
  key: K,
  value: StoreData[K],
  origin?: WebContents
): void {
  data = { ...data, [key]: value }
  dirty = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(writeNow, 300)
  for (const wc of BrowserWindow.getAllWindows().map((w) => w.webContents)) {
    if (wc !== origin && !wc.isDestroyed()) wc.send(IPC.storeChanged, key, value)
  }
  listeners.get(key)?.forEach((cb) => cb(value))
}

/** For values only the main process writes: saved to disk, but not broadcast to any window. */
export function setStoreSilently<K extends StoreKey>(key: K, value: StoreData[K]): void {
  data = { ...data, [key]: value }
  dirty = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(writeNow, 300)
}

// Folders of terminals that no longer exist are dropped.
function pruneCwds(): void {
  const ids = new Set(data.workspaces?.workspaces.flatMap((w) => w.panes.map((p) => p.id)))
  const kept = Object.fromEntries(Object.entries(data.paneCwds).filter(([id]) => ids.has(id)))
  if (Object.keys(kept).length !== Object.keys(data.paneCwds).length)
    setStoreSilently('paneCwds', kept)
}

export function registerStoreIpc(): void {
  // Synchronous on purpose: it runs once per window before the first paint.
  ipcMain.on(IPC.storeLoad, (event) => {
    event.returnValue = data
  })

  ipcMain.on(IPC.storeSet, (event, key: StoreKey, value: unknown) => {
    if (key === 'settings') setStoreValue('settings', normalizeSettings(value), event.sender)
    else if (key === 'workspaces') {
      setStoreValue('workspaces', value === null ? null : sanitizeWorkspaces(value), event.sender)
      pruneCwds()
    }
    // widgetBounds is owned by the main process.
  })

  ipcMain.on(IPC.appRevealStore, () => shell.showItemInFolder(file))
}
