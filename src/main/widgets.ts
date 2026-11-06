import { BrowserWindow, ipcMain, screen, type Rectangle } from 'electron'
import { WIDGET_DEFS, WIDGET_KINDS, type WidgetBounds, type WidgetKind } from '@shared/data'
import { IPC } from '@shared/ipc'
import { appWebPreferences, chrome, hardenWindow, isMac, loadRenderer } from './window'
import { getStore, setStoreValue } from './store'

const windows = new Map<WidgetKind, BrowserWindow>()

function isVisibleOnSomeDisplay(b: WidgetBounds): boolean {
  return screen.getAllDisplays().some(({ workArea: w }) => {
    return (
      b.x < w.x + w.width - 40 &&
      b.x + b.width > w.x + 40 &&
      b.y >= w.y - 10 &&
      b.y < w.y + w.height - 40
    )
  })
}

export function openWidget(kind: WidgetKind): void {
  const existing = windows.get(kind)
  if (existing && !existing.isDestroyed()) {
    existing.show()
    existing.focus()
    return
  }

  const def = WIDGET_DEFS[kind]
  const saved = getStore().widgetBounds[kind]
  const useSaved = saved && isVisibleOnSomeDisplay(saved)
  const pinned = getStore().settings.resources.popoutAlwaysOnTop

  const win = new BrowserWindow({
    width: useSaved ? saved.width : def.width,
    height: useSaved ? saved.height : def.height,
    ...(useSaved ? { x: saved.x, y: saved.y } : {}),
    minWidth: 220,
    minHeight: def.minHeight,
    show: false,
    frame: false,
    resizable: true,
    fullscreenable: false,
    maximizable: false,
    alwaysOnTop: pinned,
    backgroundColor: chrome().bg,
    webPreferences: appWebPreferences()
  })
  if (isMac && pinned) win.setAlwaysOnTop(true, 'floating')

  hardenWindow(win)
  win.once('ready-to-show', () => win.show())
  windows.set(kind, win)

  // Remember where the user put it, so it reopens in the same spot.
  let saveTimer: NodeJS.Timeout | null = null
  const remember = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return
      const { x, y, width, height } = win.getBounds()
      setStoreValue('widgetBounds', { ...getStore().widgetBounds, [kind]: { x, y, width, height } })
    }, 400)
  }
  win.on('moved', remember)
  win.on('resized', remember)
  win.on('closed', () => {
    if (saveTimer) clearTimeout(saveTimer)
    if (windows.get(kind) === win) windows.delete(kind)
  })

  loadRenderer(win, { widget: kind })
}

const beforeFill = new WeakMap<BrowserWindow, Rectangle>()

// "Fill" is the screen's usable area (below the menu bar, beside the dock), not full-screen
// mode: it never takes over the display and toggles back to the previous size.
function isFilled(win: BrowserWindow): boolean {
  const b = win.getBounds()
  const w = screen.getDisplayMatching(b).workArea
  return Math.abs(b.width - w.width) < 4 && Math.abs(b.height - w.height) < 4
}

export function closeAllWidgets(): void {
  for (const win of windows.values()) if (!win.isDestroyed()) win.close()
}

export function registerWidgetIpc(): void {
  ipcMain.on(IPC.widgetOpen, (_e, kind: WidgetKind) => {
    if (WIDGET_KINDS.includes(kind)) openWidget(kind)
  })
  ipcMain.on(IPC.widgetClose, (event) => BrowserWindow.fromWebContents(event.sender)?.close())
  ipcMain.on(IPC.widgetSetSize, (event, width: number, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || !Number.isFinite(width) || !Number.isFinite(height)) return
    const work = screen.getDisplayMatching(win.getBounds()).workArea
    win.setSize(Math.round(Math.min(width, work.width)), Math.round(Math.min(height, work.height)))
  })
  ipcMain.handle(IPC.widgetToggleFill, (event): boolean => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (isFilled(win)) {
      const prev = beforeFill.get(win)
      if (prev) win.setBounds(prev)
      else win.setSize(360, 480)
      return false
    }
    beforeFill.set(win, win.getBounds())
    win.setBounds(screen.getDisplayMatching(win.getBounds()).workArea)
    return true
  })
  ipcMain.on(IPC.widgetPin, (event, pinned: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (isMac) win.setAlwaysOnTop(Boolean(pinned), 'floating')
    else win.setAlwaysOnTop(Boolean(pinned))
  })
}
