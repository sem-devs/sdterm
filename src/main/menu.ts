import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { IPC, type AppCommand } from '@shared/ipc'

const isMac = process.platform === 'darwin'

function send(cmd: AppCommand): void {
  BrowserWindow.getFocusedWindow()?.webContents.send(IPC.appCommand, cmd)
}

export function installMenu(isDev: boolean): void {
  // On Windows/Linux plain Ctrl+T/W/N belong to the shell (fzf, readline), so the app
  // shortcuts use Ctrl+Shift there. There is also no Edit menu on those platforms:
  // its Ctrl+C accelerator would swallow SIGINT. Copy/paste is handled inside the pane.
  const mod = isMac ? 'Cmd' : 'Ctrl+Shift'

  const shell: MenuItemConstructorOptions = {
    label: 'Shell',
    submenu: [
      { label: 'New Terminal', accelerator: `${mod}+T`, click: () => send('new-pane') },
      { label: 'Close Terminal', accelerator: `${mod}+W`, click: () => send('close-pane') },
      { type: 'separator' },
      { label: 'New Workspace', accelerator: `${mod}+N`, click: () => send('new-workspace') }
    ]
  }

  const view: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      ...(isDev ? ([{ role: 'toggleDevTools' }] as MenuItemConstructorOptions[]) : []),
      { role: 'togglefullscreen' }
    ]
  }

  const template: MenuItemConstructorOptions[] = isMac
    ? [{ role: 'appMenu' }, shell, { role: 'editMenu' }, view, { role: 'windowMenu' }]
    : [shell, view]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
