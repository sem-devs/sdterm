import type {
  AppInfo,
  ProcessSnapshot,
  ResourceSample,
  StoreData,
  StoreKey,
  WidgetKind
} from './data'

export const IPC = {
  ptyAttach: 'pty:attach',
  ptyDetach: 'pty:detach',
  ptyPark: 'pty:park',
  ptyBusy: 'pty:busy',
  ptyCwds: 'pty:cwds',
  ptyCwd: 'pty:cwd',
  ptyReportCwd: 'pty:report-cwd',
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
  widgetPin: 'widget:pin',
  widgetSetSize: 'widget:set-size',
  widgetToggleFill: 'widget:toggle-fill',
  windowOpen: 'window:open',
  procSubscribe: 'processes:subscribe',
  procUnsubscribe: 'processes:unsubscribe',
  procSample: 'processes:sample',
  openFolder: 'app:open-folder'
} as const

export type AppCommand = 'new-pane' | 'close-pane' | 'new-workspace' | 'open-settings'

export interface PtyAttachOptions {
  /** The pane id doubles as the session id: one shell per pane, owned by the main process. */
  paneId: string
  /**
   * Identifies this particular view of the pane. A stale detach from a view that has already been
   * replaced (React mounts twice in development) must not detach the one that replaced it.
   */
  viewId: string
  cols: number
  rows: number
  /** Where a brand new shell starts when no last-known folder exists. */
  cwd?: string
  shell?: string
}

export interface PtyAttachResult {
  shell: string
  /** Recent output of a shell that was already running, to repaint a fresh terminal view. */
  replay: string
  /** True when a new shell was started, false when an existing one was re-attached. */
  fresh: boolean
}

export interface PtyApi {
  /** Starts the pane's shell, or re-attaches this window to the one already running. */
  attach: (opts: PtyAttachOptions) => Promise<PtyAttachResult>
  /** This window stops showing the shell; the shell keeps running. */
  detach: (paneId: string, viewId: string) => void
  write: (paneId: string, data: string) => void
  resize: (paneId: string, cols: number, rows: number) => void
  /** Ends the shell for good (closing a terminal). */
  kill: (paneId: string) => void
  /** Remembers each shell's folder, then ends them (parking a workspace). */
  park: (paneIds: string[]) => Promise<void>
  /** Which of these shells are running something other than an idle prompt. */
  busy: (paneIds: string[]) => Promise<string[]>
  cwds: () => Promise<Record<string, string>>
  /** The shell's current folder (fresh when it is running, else the last known one). */
  cwd: (paneId: string) => Promise<string | null>
  /** A shell that announces its folder (OSC 7 / OSC 9;9) tells us here. */
  reportCwd: (paneId: string, path: string) => void
  /** Output of one pane's shell. One IPC listener per window serves every pane. */
  onData: (paneId: string, cb: (data: string) => void) => () => void
  onExit: (paneId: string, cb: (exitCode: number) => void) => () => void
}

export interface SdtermApi {
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
    /** Resizes the calling window (used by the drag grip). */
    setSize: (width: number, height: number) => void
    /** Fills the screen's usable area, or goes back to the previous size. Returns the new state. */
    toggleFill: () => Promise<boolean>
  }
  app: {
    info: () => Promise<AppInfo>
    revealStore: () => void
    pickDirectory: () => Promise<string | null>
    /** Shows a folder in Finder (macOS) or Explorer (Windows). Resolves to an error message, or "". */
    openFolder: (path: string) => Promise<string>
  }
  processes: {
    subscribe: () => Promise<ProcessSnapshot | null>
    unsubscribe: () => void
    onSample: (cb: (snapshot: ProcessSnapshot) => void) => () => void
  }
  windows: {
    /** Opens (or focuses) an app window by id: "main", "w2", ... */
    open: (id: string) => void
  }
  onCommand: (cb: (cmd: AppCommand) => void) => () => void
}
