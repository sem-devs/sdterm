import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import { ipcMain, type WebContents } from 'electron'
import * as nodePty from 'node-pty'
import { IPC, type PtyCreateOptions, type PtyCreateResult } from '@shared/ipc'

interface Session {
  proc: nodePty.IPty
  owner: WebContents
  buffer: string
  flushTimer: NodeJS.Timeout | null
}

const sessions = new Map<string, Session>()

// Coalesce PTY output so a burst (e.g. `cat bigfile`) is not one IPC message per chunk.
const FLUSH_MS = 4

function defaultShell(): { file: string; args: string[] } {
  if (process.platform === 'win32') return { file: 'powershell.exe', args: [] }
  // Login shell: apps launched from Finder do not inherit the user's PATH otherwise.
  return { file: process.env.SHELL || '/bin/zsh', args: ['-l'] }
}

function clampSize(n: number, fallback: number): number {
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 1000) : fallback
}

function flush(id: string, s: Session): void {
  s.flushTimer = null
  if (!s.buffer) return
  const data = s.buffer
  s.buffer = ''
  if (!s.owner.isDestroyed()) s.owner.send(IPC.ptyData, id, data)
}

function destroy(id: string): void {
  const s = sessions.get(id)
  if (!s) return
  sessions.delete(id)
  if (s.flushTimer) clearTimeout(s.flushTimer)
  try {
    s.proc.kill()
  } catch {
    // already exited
  }
}

export function registerPtyIpc(): void {
  ipcMain.handle(IPC.ptyCreate, (event, opts: PtyCreateOptions): PtyCreateResult => {
    const { file, args } = defaultShell()
    const cwd = opts.cwd && existsSync(opts.cwd) ? opts.cwd : homedir()
    const id = randomUUID()
    const owner = event.sender

    const proc = nodePty.spawn(file, args, {
      name: 'xterm-256color',
      cols: clampSize(opts.cols, 80),
      rows: clampSize(opts.rows, 24),
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'sem-term'
      } as Record<string, string>
    })

    const session: Session = { proc, owner, buffer: '', flushTimer: null }
    sessions.set(id, session)

    proc.onData((data) => {
      session.buffer += data
      if (!session.flushTimer) session.flushTimer = setTimeout(() => flush(id, session), FLUSH_MS)
    })

    proc.onExit(({ exitCode }) => {
      flush(id, session)
      sessions.delete(id)
      if (!owner.isDestroyed()) owner.send(IPC.ptyExit, id, exitCode)
    })

    // Closing or reloading the window must not leak shells.
    owner.once('destroyed', () => destroy(id))

    return { id, shell: basename(file) }
  })

  ipcMain.on(IPC.ptyWrite, (_e, id: string, data: string) => {
    sessions.get(id)?.proc.write(data)
  })

  ipcMain.on(IPC.ptyResize, (_e, id: string, cols: number, rows: number) => {
    try {
      sessions.get(id)?.proc.resize(clampSize(cols, 80), clampSize(rows, 24))
    } catch {
      // resize races with exit; safe to ignore
    }
  })

  ipcMain.on(IPC.ptyKill, (_e, id: string) => destroy(id))
}

export function killAllPtys(): void {
  for (const id of [...sessions.keys()]) destroy(id)
}
