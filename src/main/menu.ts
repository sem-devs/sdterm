import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { BRAND } from '@shared/brand'
import { WIDGET_DEFS, WIDGET_KINDS } from '@shared/data'
import { IPC, type AppCommand } from '@shared/ipc'
import { openWidget } from './widgets'
import { getFocusedAppWindow, nextWindowId, openAppWindow } from './windows'

const isMac = process.platform === 'darwin'

function send(cmd: AppCommand): void {
  // Commands act on the app window you are in; widget windows have no workspace.
  getFocusedAppWindow()?.webContents.send(IPC.appCommand, cmd)
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

  const shellMenu: MenuItemConstructorOptions = {
    label: 'Shell',
    submenu: [
      { label: 'New Terminal', accelerator: `${mod}+T`, click: () => send('new-pane') },
      { label: 'Close Terminal', accelerator: `${mod}+W`, click: () => send('close-pane') },
      { type: 'separator' },
      { label: 'New Workspace', accelerator: `${mod}+N`, click: () => send('new-workspace') },
      {
        label: 'New Window',
        click: () => openAppWindow(nextWindowId(), { newWorkspace: true })
      },
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

  const help: MenuItemConstructorOptions = {
    role: 'help',
    submenu: [
      { label: 'Rate sdterm on Google', click: () => void shell.openExternal(BRAND.reviewUrl) },
      { label: 'SEM Devs Website', click: () => void shell.openExternal(BRAND.website) },
      { label: 'Contact SEM Devs', click: () => void shell.openExternal(`mailto:${BRAND.email}`) }
    ]
  }

  const template: MenuItemConstructorOptions[] = isMac
    ? [appMenu, shellMenu, { role: 'editMenu' }, resources, view, { role: 'windowMenu' }, help]
    : [shellMenu, resources, view, help]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
