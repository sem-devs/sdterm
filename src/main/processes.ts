import os from 'node:os'
import { ipcMain, shell, type WebContents } from 'electron'
import { statSync } from 'node:fs'
import * as si from 'systeminformation'
import type { ProcessInfo, ProcessSnapshot } from '@shared/data'
import { IPC } from '@shared/ipc'

// The process list is the heaviest thing we sample (a few tens of ms, more on Windows), so it
// runs only while a Processes window is open, and slower than the CPU/RAM charts.
const INTERVAL_MS = 3000
const KEEP = 100

const subscribers = new Set<WebContents>()
let timer: NodeJS.Timeout | null = null
let last: ProcessSnapshot | null = null
let busy = false

async function tick(): Promise<void> {
  if (busy) return
  busy = true
  try {
    const { list } = await si.processes()
    const all: ProcessInfo[] = list.map((p) => ({
      pid: p.pid,
      name: p.name,
      cpu: p.cpu,
      rss: (p.memRss ?? 0) * 1024 // systeminformation reports KB
    }))
    // Enough that grouping by name stays accurate for the heavy hitters, small enough for IPC.
    const merged = new Map<number, ProcessInfo>()
    for (const p of [
      ...[...all].sort((a, b) => b.cpu - a.cpu).slice(0, KEEP),
      ...[...all].sort((a, b) => b.rss - a.rss).slice(0, KEEP)
    ]) {
      merged.set(p.pid, p)
    }
    last = {
      t: Date.now(),
      cores: os.cpus().length,
      memTotal: os.totalmem(),
      list: [...merged.values()]
    }
    for (const wc of subscribers) if (!wc.isDestroyed()) wc.send(IPC.procSample, last)
  } catch (err) {
    console.error('[processes] could not read the process list', err)
  } finally {
    busy = false
  }
}

function remove(wc: WebContents): void {
  subscribers.delete(wc)
  if (subscribers.size === 0 && timer) {
    clearInterval(timer)
    timer = null
  }
}

export function registerProcessesIpc(): void {
  ipcMain.handle(IPC.procSubscribe, (event): ProcessSnapshot | null => {
    const wc = event.sender
    if (!subscribers.has(wc)) {
      subscribers.add(wc)
      wc.once('destroyed', () => remove(wc))
    }
    if (!timer) {
      void tick()
      timer = setInterval(() => void tick(), INTERVAL_MS)
    }
    return last
  })
  ipcMain.on(IPC.procUnsubscribe, (event) => remove(event.sender))

  // Finder on macOS, Explorer on Windows, the file manager on Linux.
  ipcMain.handle(IPC.openFolder, async (_e, path: unknown): Promise<string> => {
    try {
      if (typeof path !== 'string' || !statSync(path).isDirectory()) return 'Folder not found'
    } catch {
      return 'Folder not found'
    }
    return shell.openPath(path)
  })
}
