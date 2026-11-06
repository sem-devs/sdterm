import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { WIDGET_DEFS, WIDGET_KINDS } from '@shared/data'
import { IPC, type AppCommand } from '@shared/ipc'
import { openWidget } from './widgets'

const isMac = process.platform === 'darwin'

function send(cmd: AppCommand): void {
  const win = BrowserWindow.getAllWindows().find((w) => w.isFocused() && !w.isDestroyed())
  // Widget windows have no workspace to act on, so commands go to the main window.
  const target = BrowserWindow.getAllWindows().find(
    (w) => !w.webContents.getURL().includes('widget=')
  )
  ;(target ?? win)?.webContents.send(IPC.appCommand, cmd)
}

export function installMenu(isDev: boolean): void {
  // On Windows/Linux plain Ctrl+T/W/N belong to the shell (fzf, readline), so the app
  // shortcuts use Ctrl+Shift there. There is also no Edit menu on those platforms:
  // its Ctrl+C accelerator would swallow SIGINT. Copy/paste is handled inside the pane.
  const mod = isMac ? 'Cmd' : 'Ctrl+Shift'
  const settingsItem: MenuItemConstructorOptions = {
    label: 'Settings…',
    accelerator: isMac ? 'Cmd+,' : 'Ctrl+Shift+,',
    click: () => send('open-settings')
  }

  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      settingsItem,
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }

  const shell: MenuItemConstructorOptions = {
    label: 'Shell',
    submenu: [
      { label: 'New Terminal', accelerator: `${mod}+T`, click: () => send('new-pane') },
      { label: 'Close Terminal', accelerator: `${mod}+W`, click: () => send('close-pane') },
      { type: 'separator' },
      { label: 'New Workspace', accelerator: `${mod}+N`, click: () => send('new-workspace') },
      ...(isMac ? [] : ([{ type: 'separator' }, settingsItem] as MenuItemConstructorOptions[]))
    ]
  }

  const resources: MenuItemConstructorOptions = {
    label: 'Resources',
    submenu: WIDGET_KINDS.map((kind) => ({
      label: `Pop Out ${WIDGET_DEFS[kind].label}`,
      click: () => openWidget(kind)
    }))
  }

  const view: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      ...(isDev ? ([{ role: 'toggleDevTools' }] as MenuItemConstructorOptions[]) : []),
      { role: 'togglefullscreen' }
    ]
  }

  const template: MenuItemConstructorOptions[] = isMac
    ? [appMenu, shell, { role: 'editMenu' }, resources, view, { role: 'windowMenu' }]
    : [shell, resources, view]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
