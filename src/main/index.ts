import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC, type TerminalMenuChoice } from '@shared/ipc'
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
import { registerProcessesIpc } from './processes'
import { registerWidgetIpc } from './widgets'
import { getAppWindows, markQuitting, openAppWindow } from './windows'
import { isMac, syncChrome } from './window'
import { runDevCapture } from './dev-capture'

if (!app.isPackaged && process.env.SDTERM_USER_DATA) {
  app.setPath('userData', process.env.SDTERM_USER_DATA)
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
  ipcMain.on(IPC.windowOpen, (_e, id: string) => openAppWindow(id))
  ipcMain.handle(IPC.terminalMenu, (event, hasSelection: boolean) => {
    return new Promise<TerminalMenuChoice | null>((resolve) => {
      const pick = (choice: TerminalMenuChoice) => () => resolve(choice)
      const menu = Menu.buildFromTemplate([
        { label: 'Copy', enabled: Boolean(hasSelection), click: pick('copy') },
        { label: 'Paste', click: pick('paste') },
        { type: 'separator' },
        { label: 'Select All', click: pick('select-all') },
        { label: 'Clear', click: pick('clear') }
      ])
      menu.popup({
        window: BrowserWindow.fromWebContents(event.sender) ?? undefined,
        callback: () => resolve(null)
      })
    })
  })
}

// Windows that were open when the app last closed, main first.
function windowIdsToRestore(): string[] {
  const ids = new Set<string>(['main'])
  for (const w of getStore().workspaces?.workspaces ?? []) ids.add(w.windowId)
  return [...ids]
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
  registerProcessesIpc()
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
    for (const win of BrowserWindow.getAllWindows()) syncChrome(win, getAppWindows().includes(win))
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  installMenu(is.dev)

  const restored = getStore().settings.workspaces.restoreOnLaunch
  const main = openAppWindow('main')
  if (restored) for (const id of windowIdsToRestore()) if (id !== 'main') openAppWindow(id)
  if (main) runDevCapture(main)

  app.on('activate', () => {
    if (!getAppWindows().some((w) => !w.isDestroyed())) openAppWindow('main')
  })
})

let shellsStopped = false
app.on('before-quit', (event) => {
  markQuitting()
  if (shellsStopped) return
  // Hold the quit until the shells have really exited, then quit again.
  event.preventDefault()
  shellsStopped = true
  void killAllPtys().then(() => {
    flushStore()
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
