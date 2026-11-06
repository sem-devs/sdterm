import { app, ipcMain, shell, BrowserWindow, type WebContents } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PANE_COLORS, DEFAULT_SETTINGS, normalizeSettings, type PaneColor } from '@shared/settings'
import type { PersistedWorkspaces, StoreData, StoreKey, WidgetBounds } from '@shared/data'
import { IPC } from '@shared/ipc'

let data: StoreData = { settings: DEFAULT_SETTINGS, workspaces: null, widgetBounds: {} }
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
    panes: (Array.isArray(w.panes) ? w.panes : []).filter(isObj).map((p) => ({
      id: str(p.id, 64, crypto.randomUUID()),
      name: str(p.name, 80),
      note: str(p.note, 1000),
      color: PANE_COLORS.includes(p.color as PaneColor) ? (p.color as PaneColor) : null
    })),
    activePaneId: typeof w.activePaneId === 'string' ? w.activePaneId : null
  }))
  if (workspaces.length === 0) return null
  const active = typeof v.activeWorkspaceId === 'string' ? v.activeWorkspaceId : ''
  return {
    workspaces,
    activeWorkspaceId: workspaces.some((w) => w.id === active) ? active : workspaces[0].id
  }
}

function sanitizeBounds(v: unknown): StoreData['widgetBounds'] {
  const out: StoreData['widgetBounds'] = {}
  if (!isObj(v)) return out
  for (const [kind, b] of Object.entries(v)) {
    if (!isObj(b)) continue
    const { x, y, width, height } = b
    if ([x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      out[kind as keyof StoreData['widgetBounds']] = { x, y, width, height } as WidgetBounds
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
      widgetBounds: sanitizeBounds(o.widgetBounds)
    }
  } catch {
    // First run, or an unreadable file: start from defaults. The bad file is overwritten
    // on the next save.
    data = { settings: DEFAULT_SETTINGS, workspaces: null, widgetBounds: {} }
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

export function registerStoreIpc(): void {
  // Synchronous on purpose: it runs once per window before the first paint.
  ipcMain.on(IPC.storeLoad, (event) => {
    event.returnValue = data
  })

  ipcMain.on(IPC.storeSet, (event, key: StoreKey, value: unknown) => {
    if (key === 'settings') setStoreValue('settings', normalizeSettings(value), event.sender)
    else if (key === 'workspaces') {
      setStoreValue('workspaces', value === null ? null : sanitizeWorkspaces(value), event.sender)
    }
    // widgetBounds is owned by the main process.
  })

  ipcMain.on(IPC.appRevealStore, () => shell.showItemInFolder(file))
}
