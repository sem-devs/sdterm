import { join } from 'path'
import { BrowserWindow, nativeTheme, shell, type WebPreferences } from 'electron'
import { is } from '@electron-toolkit/utils'

export const isMac = process.platform === 'darwin'

// Same values as --background in the renderer, so the window never flashes the wrong
// colour while the page loads.
const BG = { dark: '#141414', light: '#f8f8f8' }

export function chrome(): { bg: string; symbol: string } {
  return nativeTheme.shouldUseDarkColors
    ? { bg: BG.dark, symbol: '#9a9a9a' }
    : { bg: BG.light, symbol: '#5a5a5a' }
}

export function syncChrome(win: BrowserWindow, overlay: boolean): void {
  if (win.isDestroyed()) return
  const { bg, symbol } = chrome()
  win.setBackgroundColor(bg)
  if (overlay && !isMac) win.setTitleBarOverlay({ color: bg, symbolColor: symbol, height: 40 })
}

export function appWebPreferences(): WebPreferences {
  return {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false
  }
}

export function loadRenderer(win: BrowserWindow, query: Record<string, string> = {}): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
    void win.loadURL(url.toString())
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }
}

/** Links open in the system browser (http and https only); the app never navigates away. */
export function hardenWindow(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL()
    try {
      if (new URL(url).origin !== new URL(current).origin) {
        event.preventDefault()
        if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
      }
    } catch {
      event.preventDefault()
    }
  })
}
