import type { AppInfo, ResourceSample, StoreData, StoreKey, WidgetKind } from './data'

export const IPC = {
  ptyCreate: 'pty:create',
  ptyWrite: 'pty:write',
  ptyResize: 'pty:resize',
  ptyKill: 'pty:kill',
  ptyData: 'pty:data',
  ptyExit: 'pty:exit',
  appCommand: 'app:command',
  appInfo: 'app:info',
  appRevealStore: 'app:reveal-store',
  pickDirectory: 'dialog:pick-directory',
  storeLoad: 'store:load',
  storeSet: 'store:set',
  storeChanged: 'store:changed',
  resSubscribe: 'resources:subscribe',
  resUnsubscribe: 'resources:unsubscribe',
  resSample: 'resources:sample',
  widgetOpen: 'widget:open',
  widgetClose: 'widget:close',
  widgetPin: 'widget:pin'
} as const

export type AppCommand = 'new-pane' | 'close-pane' | 'new-workspace' | 'open-settings'

export interface PtyCreateOptions {
  cols: number
  rows: number
  cwd?: string
  shell?: string
}

export interface PtyCreateResult {
  id: string
  shell: string
}

export interface PtyApi {
  create: (opts: PtyCreateOptions) => Promise<PtyCreateResult>
  write: (id: string, data: string) => void
  resize: (id: string, cols: number, rows: number) => void
  kill: (id: string) => void
  onData: (cb: (id: string, data: string) => void) => () => void
  onExit: (cb: (id: string, exitCode: number) => void) => () => void
}

export interface SemTermApi {
  platform: NodeJS.Platform
  /** Loaded synchronously at startup so the first paint already has the right theme and layout. */
  initial: StoreData
  pty: PtyApi
  store: {
    set: <K extends StoreKey>(key: K, value: StoreData[K]) => void
    onChanged: (cb: <K extends StoreKey>(key: K, value: StoreData[K]) => void) => () => void
  }
  resources: {
    /** Starts the feed for this window and returns the recent history. */
    subscribe: () => Promise<ResourceSample[]>
    unsubscribe: () => void
    onSample: (cb: (sample: ResourceSample) => void) => () => void
  }
  widgets: {
    open: (kind: WidgetKind) => void
    /** Closes the widget window that calls it. */
    close: () => void
    setPinned: (pinned: boolean) => void
  }
  app: {
    info: () => Promise<AppInfo>
    revealStore: () => void
    pickDirectory: () => Promise<string | null>
  }
  onCommand: (cb: (cmd: AppCommand) => void) => () => void
}
