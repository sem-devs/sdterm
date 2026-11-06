import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '@shared/ipc'
import type { AppInfo } from '@shared/data'
import { killAllPtys, registerPtyIpc } from './pty'
import { installMenu } from './menu'
import {
  flushStore,
  getStore,
  initStore,
  onStoreChange,
  registerStoreIpc,
  storePath
} from './store'
import { registerResourcesIpc, setSampleInterval } from './resources'
import { closeAllWidgets, registerWidgetIpc } from './widgets'
import { appWebPreferences, chrome, hardenWindow, isMac, loadRenderer, syncChrome } from './window'
import { runDevCapture } from './dev-capture'

if (!app.isPackaged && process.env.SDTERM_USER_DATA) {
  app.setPath('userData', process.env.SDTERM_USER_DATA)
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
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
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: appWebPreferences()
  })
  mainWindow = win

  hardenWindow(win)
  const startMaximized = getStore().settings.window.startMaximized
  win.on('ready-to-show', () => {
    // Screen-sized but still a normal window: no full-screen Space, resizable, and the
    // green/maximize button toggles back to the previous size.
    if (startMaximized) win.maximize()
    win.show()
  })
  // Pop-out widgets belong to the session: they go away with the main window.
  win.on('closed', () => {
    mainWindow = null
    closeAllWidgets()
  })

  if (is.dev) {
    win.webContents.on('console-message', (event) => {
      if (event.level === 'error' || event.level === 'warning') {
        console.log(`[renderer ${event.level}] ${event.message}`)
      }
    })
  }

  loadRenderer(win)
  runDevCapture(win)
}

function registerAppIpc(): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    name: app.name,
    version: app.getVersion(),
    platform: process.platform,
    storePath: storePath()
  }))
  ipcMain.handle(IPC.pickDirectory, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.semdevs.sdterm')
  app.setAboutPanelOptions({
    applicationName: 'sdterm',
    applicationVersion: app.getVersion(),
    copyright: 'SEM Devs',
    website: 'https://sem-devs.com'
  })

  initStore()
  registerStoreIpc()
  registerPtyIpc()
  registerResourcesIpc()
  registerWidgetIpc()
  registerAppIpc()

  // The theme and the sampling rate live in Settings; main applies them wherever they change.
  const applySettings = (s = getStore().settings): void => {
    nativeTheme.themeSource = s.appearance.theme
    setSampleInterval(s.resources.intervalMs)
  }
  applySettings()
  onStoreChange('settings', (s) => applySettings(s))
  nativeTheme.on('updated', () => {
    for (const win of BrowserWindow.getAllWindows()) syncChrome(win, win === mainWindow)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  installMenu(is.dev)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  killAllPtys()
  flushStore()
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
