import { app, shell, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerPtyIpc, killAllPtys } from './pty'
import { installMenu } from './menu'
import { IPC, type ThemeSource } from '@shared/ipc'

const isMac = process.platform === 'darwin'

// Match --background in the renderer, so the window never flashes the wrong colour while loading.
const BG_DARK = '#18181b'
const BG_LIGHT = '#fafafa'

function chrome(): { bg: string; symbol: string } {
  return nativeTheme.shouldUseDarkColors
    ? { bg: BG_DARK, symbol: '#a1a1aa' }
    : { bg: BG_LIGHT, symbol: '#52525b' }
}

function syncChrome(win: BrowserWindow): void {
  const { bg, symbol } = chrome()
  win.setBackgroundColor(bg)
  if (!isMac) win.setTitleBarOverlay({ color: bg, symbolColor: symbol, height: 40 })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 460,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: chrome().bg,
    // Custom title bar: native traffic lights on macOS, native controls overlay on Windows.
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 14, y: 13 } } : {}),
    ...(!isMac
      ? { titleBarOverlay: { color: chrome().bg, symbolColor: chrome().symbol, height: 40 } }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Links from the terminal open in the system browser, http(s) only.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev) {
    mainWindow.webContents.on('console-message', (event) => {
      if (event.level === 'error' || event.level === 'warning') {
        console.log(`[renderer ${event.level}] ${event.message}`)
      }
    })
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.semdevs.semterm')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerPtyIpc()
  ipcMain.on(IPC.setTheme, (_e, mode: ThemeSource) => {
    if (mode === 'system' || mode === 'light' || mode === 'dark') nativeTheme.themeSource = mode
  })
  nativeTheme.on('updated', () => BrowserWindow.getAllWindows().forEach(syncChrome))
  installMenu(is.dev)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', killAllPtys)

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
