import { execFile, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readlinkSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import { app, ipcMain, type WebContents } from 'electron'
import * as nodePty from 'node-pty'
import { IPC, type PtyAttachOptions, type PtyAttachResult } from '@shared/ipc'
import { getStore, setStoreSilently } from './store'

/*
 * Shells belong to the main process, not to a window. A window attaches to a pane's shell and
 * detaches again; the shell keeps running in between. That is what lets a workspace move to
 * another window (or survive a window closing) without losing its processes, and the recent
 * output is replayed so the new view is not blank.
 */

interface Session {
  proc: nodePty.IPty
  file: string
  owner: WebContents | null
  /** The view (see PtyAttachOptions.viewId) that currently receives output. */
  view: string | null
  /** Recent output, replayed when a window attaches. */
  history: string[]
  historyLen: number
  /** Output not yet sent to the attached window. */
  pending: string
  flushTimer: NodeJS.Timeout | null
  /** Set on purpose-killed sessions so the exit is not reported as "the shell closed". */
  killed: boolean
}

const sessions = new Map<string, Session>()

// Coalesce PTY output so a burst (e.g. `cat bigfile`) is not one IPC message per chunk.
const FLUSH_MS = 4
const HISTORY_MAX = 600_000

const run = promisify(execFile)

function defaultShell(): { file: string; args: string[] } {
  if (process.platform === 'win32') return { file: 'powershell.exe', args: [] }
  // Login shell: apps launched from Finder do not inherit the user's PATH otherwise.
  return { file: process.env.SHELL || '/bin/zsh', args: ['-l'] }
}

// A shell chosen in Settings. A bare name (e.g. "fish", "pwsh.exe") is resolved through
// PATH by the OS; anything with a path separator must exist.
function configuredShell(custom?: string): { file: string; args: string[] } | null {
  const file = custom?.trim()
  if (!file) return null
  if (/[\\/]/.test(file) && !existsSync(file)) return null
  return { file, args: process.platform === 'win32' ? [] : ['-l'] }
}

// Variables that describe the process that launched sdterm, not the user's terminal. They must not
// leak into shells: a Claude Code started inside a terminal would think it is a child of another
// session (and so skip saving transcripts), and npm/Electron variables confuse project tooling.
const LAUNCHER_VARS =
  /^(CLAUDECODE|CLAUDE_PID|CLAUDE_EFFORT|INIT_CWD|CLAUDE_CODE_(CHILD_SESSION|ENTRYPOINT|EXECPATH|SESSION_.*|MESSAGING_.*)|npm_.*|ELECTRON_.*)$/

// Terminal.app always starts shells with a UTF-8 locale. An app opened from Finder has none, and
// without it accented characters and emoji come out as garbage in the shell.
function defaultLang(): string {
  if (process.platform !== 'darwin') return 'C.UTF-8'
  const [lang, region] = app.getLocale().split('-')
  const regions: Record<string, string> = {
    en: 'US',
    it: 'IT',
    de: 'DE',
    fr: 'FR',
    es: 'ES',
    pt: 'PT'
  }
  return `${lang}_${region ?? regions[lang] ?? lang.toUpperCase()}.UTF-8`
}

function shellEnvironment(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !LAUNCHER_VARS.test(key)) env[key] = value
  }
  if (!env.LANG && !env.LC_ALL) env.LANG = defaultLang()
  return {
    ...env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'sdterm',
    TERM_PROGRAM_VERSION: app.getVersion()
  }
}

// Command suggestions and Tab completion for zsh. zsh is pointed at a startup folder that runs the
// user's own files first (resources/shell/zsh), so their ~/.zshrc is never edited.
function shellIntegrationDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'shell')
    : join(app.getAppPath(), 'resources', 'shell')
}

function suggestionEnvironment(file: string): Record<string, string> {
  if (process.platform === 'win32' || basename(file) !== 'zsh') return {}
  if (!getStore().settings.terminal.suggestions) return {}
  const dir = shellIntegrationDir()
  if (!existsSync(join(dir, 'zsh', '.zshrc'))) return {}
  const state = join(app.getPath('userData'), 'shell')
  try {
    mkdirSync(state, { recursive: true })
  } catch {
    return {}
  }
  return {
    ZDOTDIR: join(dir, 'zsh'),
    SDTERM_ZDOTDIR_ORIG: process.env.ZDOTDIR ?? '',
    SDTERM_SHELL_DIR: dir,
    SDTERM_STATE_DIR: state,
    SDTERM_SUGGESTIONS: '1'
  }
}

const clampSize = (n: number, fallback: number): number =>
  Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 1000) : fallback

function isDirectory(path: string | undefined): path is string {
  if (!path) return false
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function pushHistory(s: Session, data: string): void {
  s.history.push(data)
  s.historyLen += data.length
  while (s.historyLen > HISTORY_MAX && s.history.length > 1)
    s.historyLen -= s.history.shift()!.length
}

function flush(paneId: string, s: Session): void {
  s.flushTimer = null
  const data = s.pending
  s.pending = ''
  if (data && s.owner && !s.owner.isDestroyed()) s.owner.send(IPC.ptyData, paneId, data)
}

function killSession(paneId: string): void {
  const s = sessions.get(paneId)
  if (!s) return
  sessions.delete(paneId)
  s.killed = true
  if (s.flushTimer) clearTimeout(s.flushTimer)
  try {
    s.proc.kill()
  } catch {
    // already exited
  }
}

// ---- Working directory tracking -------------------------------------------------------------

function parseLsof(out: string): Map<number, string> {
  const map = new Map<number, string>()
  let pid = 0
  for (const line of out.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1))
    else if (line.startsWith('n') && pid) map.set(pid, line.slice(1))
  }
  return map
}

// lsof exits non-zero when any listed pid is gone but still prints the others.
function lsofArgs(pids: number[]): string[] {
  return ['-a', '-d', 'cwd', '-Fpn', '-p', pids.join(',')]
}

async function readCwds(pids: number[]): Promise<Map<number, string>> {
  if (pids.length === 0) return new Map()
  if (process.platform === 'darwin') {
    try {
      return parseLsof((await run('lsof', lsofArgs(pids))).stdout)
    } catch (err) {
      return parseLsof((err as { stdout?: string }).stdout ?? '')
    }
  }
  if (process.platform === 'linux') {
    const map = new Map<number, string>()
    for (const pid of pids) {
      try {
        map.set(pid, readlinkSync(`/proc/${pid}/cwd`))
      } catch {
        // process gone
      }
    }
    return map
  }
  return new Map() // Windows: not available; shells can report it with OSC 7 / OSC 9;9
}

function readCwdsSync(pids: number[]): Map<number, string> {
  if (pids.length === 0) return new Map()
  if (process.platform === 'darwin') {
    try {
      return parseLsof(execFileSync('lsof', lsofArgs(pids), { encoding: 'utf8', timeout: 3000 }))
    } catch (err) {
      return parseLsof(String((err as { stdout?: string }).stdout ?? ''))
    }
  }
  if (process.platform === 'linux') {
    const map = new Map<number, string>()
    for (const pid of pids) {
      try {
        map.set(pid, readlinkSync(`/proc/${pid}/cwd`))
      } catch {
        // process gone
      }
    }
    return map
  }
  return new Map()
}

function storeCwds(found: Map<number, string>, ids: string[]): void {
  const next = { ...getStore().paneCwds }
  for (const id of ids) {
    const s = sessions.get(id)
    const cwd = s ? found.get(s.proc.pid) : undefined
    if (cwd) next[id] = cwd
  }
  setStoreSilently('paneCwds', next)
}

async function snapshotCwds(paneIds?: string[]): Promise<void> {
  const ids = (paneIds ?? [...sessions.keys()]).filter((id) => sessions.has(id))
  const found = await readCwds(ids.map((id) => sessions.get(id)!.proc.pid))
  storeCwds(found, ids)
}

// ---------------------------------------------------------------------------------------------

export function registerPtyIpc(): void {
  // Closing a window detaches its shells; it must not end them.
  app.on('web-contents-created', (_e, wc) => {
    wc.once('destroyed', () => {
      for (const s of sessions.values()) {
        if (s.owner === wc) {
          s.owner = null
          s.view = null
        }
      }
    })
  })

  ipcMain.handle(IPC.ptyAttach, (event, opts: PtyAttachOptions): PtyAttachResult => {
    const { paneId } = opts
    const owner = event.sender
    const existing = sessions.get(paneId)

    if (existing) {
      existing.owner = owner
      existing.view = opts.viewId
      const replay = existing.history.join('')
      existing.pending = '' // already contained in the history we are returning
      return { shell: basename(existing.file), replay, fresh: false }
    }

    // New shell. It starts where the previous one for this pane left off, if known.
    const remembered = getStore().paneCwds[paneId]
    const cwd = isDirectory(remembered) ? remembered : isDirectory(opts.cwd) ? opts.cwd : homedir()

    const spawn = (shell: { file: string; args: string[] }): nodePty.IPty =>
      nodePty.spawn(shell.file, shell.args, {
        name: 'xterm-256color',
        cols: clampSize(opts.cols, 80),
        rows: clampSize(opts.rows, 24),
        cwd,
        env: { ...shellEnvironment(), ...suggestionEnvironment(shell.file) }
      })

    // A typo in the shell setting must not leave the user without any terminal.
    const chosen = configuredShell(opts.shell)
    let file = (chosen ?? defaultShell()).file
    let proc: nodePty.IPty
    try {
      proc = spawn(chosen ?? defaultShell())
    } catch (err) {
      if (!chosen) throw err
      file = defaultShell().file
      proc = spawn(defaultShell())
    }

    const session: Session = {
      proc,
      file,
      owner,
      view: opts.viewId,
      history: [],
      historyLen: 0,
      pending: '',
      flushTimer: null,
      killed: false
    }
    sessions.set(paneId, session)

    proc.onData((data) => {
      pushHistory(session, data)
      if (!session.owner) return
      session.pending += data
      if (!session.flushTimer)
        session.flushTimer = setTimeout(() => flush(paneId, session), FLUSH_MS)
    })

    proc.onExit(({ exitCode }) => {
      flush(paneId, session)
      if (sessions.get(paneId) === session) sessions.delete(paneId)
      if (!session.killed && session.owner && !session.owner.isDestroyed()) {
        session.owner.send(IPC.ptyExit, paneId, exitCode)
      }
    })

    return { shell: basename(file), replay: '', fresh: true }
  })

  ipcMain.on(IPC.ptyDetach, (event, paneId: string, viewId: string) => {
    const s = sessions.get(paneId)
    // Only the view that is attached right now can detach; an older one has nothing to release.
    if (s && s.owner === event.sender && s.view === viewId) {
      s.owner = null
      s.view = null
    }
  })

  ipcMain.on(IPC.ptyWrite, (_e, paneId: string, data: string) => {
    sessions.get(paneId)?.proc.write(data)
  })

  ipcMain.on(IPC.ptyResize, (_e, paneId: string, cols: number, rows: number) => {
    try {
      sessions.get(paneId)?.proc.resize(clampSize(cols, 80), clampSize(rows, 24))
    } catch {
      // resize races with exit; safe to ignore
    }
  })

  ipcMain.on(IPC.ptyKill, (_e, paneId: string) => killSession(paneId))

  ipcMain.handle(IPC.ptyPark, async (_e, paneIds: string[]) => {
    await snapshotCwds(paneIds) // remember where each shell was before it goes away
    for (const id of paneIds) killSession(id)
  })

  ipcMain.handle(IPC.ptyBusy, (_e, paneIds: string[]): string[] => {
    const norm = (name: string): string =>
      basename(name)
        .replace(/\.exe$/i, '')
        .replace(/^-/, '')
    return paneIds.filter((id) => {
      const s = sessions.get(id)
      if (!s) return false
      try {
        return norm(s.proc.process) !== norm(s.file) // something is running in the foreground
      } catch {
        return false
      }
    })
  })

  ipcMain.handle(IPC.ptyCwds, async (): Promise<Record<string, string>> => {
    await snapshotCwds()
    return getStore().paneCwds
  })

  ipcMain.handle(IPC.ptyCwd, async (_e, paneId: string): Promise<string | null> => {
    if (sessions.has(paneId)) await snapshotCwds([paneId])
    const cwd = getStore().paneCwds[paneId]
    return isDirectory(cwd) ? cwd : null
  })

  ipcMain.on(IPC.ptyReportCwd, (_e, paneId: string, path: string) => {
    if (typeof path === 'string' && isDirectory(path) && sessions.has(paneId)) {
      setStoreSilently('paneCwds', { ...getStore().paneCwds, [paneId]: path })
    }
  })

  // Keep the remembered folders fresh, so a crash or a forced quit loses little.
  setInterval(() => {
    if (sessions.size > 0) void snapshotCwds()
  }, 20_000).unref()
}

/**
 * Quitting: remember every folder one last time, end all shells, and wait until they have
 * really exited. Letting the process die while node-pty's reader threads are still running
 * can abort it with a native exception (macOS then shows a "quit unexpectedly" dialog).
 */
export function killAllPtys(): Promise<void> {
  const ids = [...sessions.keys()]
  storeCwds(readCwdsSync(ids.map((id) => sessions.get(id)!.proc.pid)), ids)
  const exited = ids.map(
    (id) =>
      new Promise<void>((resolve) => {
        sessions.get(id)!.proc.onExit(() => resolve())
      })
  )
  for (const id of ids) killSession(id)
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500))
  return Promise.race([Promise.all(exited).then(() => undefined), timeout])
}
