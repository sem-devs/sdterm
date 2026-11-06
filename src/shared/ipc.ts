export const IPC = {
  ptyCreate: 'pty:create',
  ptyWrite: 'pty:write',
  ptyResize: 'pty:resize',
  ptyKill: 'pty:kill',
  ptyData: 'pty:data',
  ptyExit: 'pty:exit',
  appCommand: 'app:command',
  setTheme: 'app:set-theme'
} as const

export type ThemeSource = 'system' | 'light' | 'dark'

export type AppCommand = 'new-pane' | 'close-pane' | 'new-workspace'

export interface PtyCreateOptions {
  cols: number
  rows: number
  cwd?: string
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
  pty: PtyApi
  onCommand: (cb: (cmd: AppCommand) => void) => () => void
  setTheme: (mode: ThemeSource) => void
}
