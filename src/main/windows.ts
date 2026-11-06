import { app, BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { APP_WINDOW_ID, type WidgetBounds } from '@shared/data'
import { IPC } from '@shared/ipc'
import icon from '../../resources/icon.png?asset'
import { getStore, setStoreSilently, setStoreValue } from './store'
import { closeAllWidgets } from './widgets'
import { appWebPreferences, chrome, hardenWindow, isMac, loadRenderer } from './window'

/*
 * App windows. "main" is the first one; "w2", "w3"... are extra windows the user opens to
 * spread workspaces over more than one window. Each workspace belongs to exactly one window
 * (see PersistedWorkspace.windowId), and the layout is restored at the next launch.
 */

const windows = new Map<string, BrowserWindow>()
let quitting = false

export const markQuitting = (): void => {
  quitting = true
}

export function getAppWindows(): BrowserWindow[] {
  return [...windows.values()].filter((w) => !w.isDestroyed())
}

export function getFocusedAppWindow(): BrowserWindow | undefined {
  const all = getAppWindows()
  return all.find((w) => w.isFocused()) ?? windows.get('main') ?? all[0]
}

export function nextWindowId(): string {
  for (let i = 2; i < 100; i++) {
    const id = `w${i}`
    if (!windows.has(id)) return id
  }
  return 'w99'
}

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

// A secondary window closed by the user hands its workspaces back to the main window,
// so nothing disappears. (When the app is quitting the layout is kept as it is.)
function returnWorkspacesToMain(windowId: string): void {
  const model = getStore().workspaces
  if (!model) return
  const activeByWindow = { ...model.activeByWindow }
  delete activeByWindow[windowId]
  setStoreValue('workspaces', {
    workspaces: model.workspaces.map((w) =>
      w.windowId === windowId ? { ...w, windowId: 'main' } : w
    ),
    activeByWindow
  })
}

export function openAppWindow(
  id: string,
  opts: { newWorkspace?: boolean } = {}
): BrowserWindow | null {
  if (!APP_WINDOW_ID.test(id)) return null
  const existing = windows.get(id)
  if (existing && !existing.isDestroyed()) {
    existing.show()
    existing.focus()
    return existing
  }

  const saved = getStore().windowBounds[id]
  const useSaved = saved && isVisibleOnSomeDisplay(saved)
  const startMaximized = id === 'main' && getStore().settings.window.startMaximized

  const win = new BrowserWindow({
    width: useSaved ? saved.width : id === 'main' ? 1280 : 1100,
    height: useSaved ? saved.height : id === 'main' ? 800 : 740,
    ...(useSaved ? { x: saved.x, y: saved.y } : {}),
    minWidth: 760,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: chrome().bg,
    // Custom title bar: native traffic lights on macOS, native controls overlay on Windows.
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 14, y: 13 } } : {}),
    ...(!isMac
      ? { titleBarOverlay: { color: chrome().bg, symbolColor: chrome().symbol, height: 40 } }
      : {}),
    ...(!isMac ? { icon } : {}),
    webPreferences: appWebPreferences()
  })
  windows.set(id, win)

  hardenWindow(win)
  if (is.dev) {
    win.webContents.on('console-message', (event) => {
      if (event.level === 'error' || event.level === 'warning') {
        console.log(`[renderer ${id} ${event.level}] ${event.message}`)
      }
    })
  }
  win.on('ready-to-show', () => {
    // Screen-sized but still a normal window: no full-screen Space, resizable, and the
    // green/maximize button toggles back to the previous size.
    if (startMaximized) win.maximize()
    win.show()
  })

  // Remember where each window was, so the layout comes back as it was left.
  let saveTimer: NodeJS.Timeout | null = null
  const remember = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (win.isDestroyed() || win.isMaximized()) return
      const { x, y, width, height } = win.getBounds()
      setStoreSilently('windowBounds', {
        ...getStore().windowBounds,
        [id]: { x, y, width, height }
      })
    }, 400)
  }
  win.on('moved', remember)
  win.on('resized', remember)

  win.on('closed', () => {
    if (saveTimer) clearTimeout(saveTimer)
    if (windows.get(id) === win) windows.delete(id)
    if (quitting) return
    if (id !== 'main') returnWorkspacesToMain(id)
    if (id === 'main' && !isMac) app.quit()
    if (windows.size === 0) closeAllWidgets()
  })

  if (opts.newWorkspace) {
    win.webContents.once('did-finish-load', () =>
      win.webContents.send(IPC.appCommand, 'new-workspace')
    )
  }

  loadRenderer(win, { window: id })
  return win
}
