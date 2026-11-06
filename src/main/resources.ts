import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ipcMain, type WebContents } from 'electron'
import * as si from 'systeminformation'
import type { ResourceSample } from '@shared/data'
import { IPC } from '@shared/ipc'

const run = promisify(execFile)

const HISTORY = 120
const history: ResourceSample[] = []
const subscribers = new Set<WebContents>()
let timer: NodeJS.Timeout | null = null
let intervalMs = 2000
let busy = false

// CPU: derived from os.cpus() deltas, so sampling costs nothing (no child process).
let prevCpu = readCpuTimes()
function readCpuTimes(): { idle: number; total: number } {
  let idle = 0
  let total = 0
  for (const { times } of os.cpus()) {
    idle += times.idle
    total += times.user + times.nice + times.sys + times.idle + times.irq
  }
  return { idle, total }
}
function cpuPercent(): number {
  const cur = readCpuTimes()
  const dTotal = cur.total - prevCpu.total
  const dIdle = cur.idle - prevCpu.idle
  prevCpu = cur
  return dTotal > 0 ? Math.min(100, Math.max(0, (1 - dIdle / dTotal) * 100)) : 0
}

// RAM: on macOS "free" memory is misleading (the OS keeps caches). Activity Monitor's
// "Memory Used" is app + wired + compressed memory, which is what vm_stat lets us compute.
async function readMemory(): Promise<{ used: number; total: number }> {
  const total = os.totalmem()
  if (process.platform === 'darwin') {
    try {
      const { stdout } = await run('vm_stat')
      const page = Number(/page size of (\d+) bytes/.exec(stdout)?.[1] ?? 16384)
      const pages = (name: string): number =>
        Number(new RegExp(`${name}:\\s+(\\d+)\\.`).exec(stdout)?.[1] ?? 0)
      const used =
        (pages('Anonymous pages') -
          pages('Pages purgeable') +
          pages('Pages wired down') +
          pages('Pages occupied by compressor')) *
        page
      if (used > 0) return { used: Math.min(used, total), total }
    } catch {
      // fall through to the generic estimate
    }
  }
  return { used: total - os.freemem(), total }
}

async function readDisk(): Promise<{ read: number | null; write: number | null }> {
  try {
    const f = await si.fsStats()
    return { read: f?.rx_sec ?? null, write: f?.wx_sec ?? null }
  } catch {
    return { read: null, write: null }
  }
}

// Only the default interface: counting every one double-counts VPN tunnels, which carry
// the same bytes as the physical interface underneath.
let defaultIface = ''
let ifaceCheckedAt = 0
async function readNet(): Promise<{ down: number | null; up: number | null }> {
  try {
    if (!defaultIface || Date.now() - ifaceCheckedAt > 60_000) {
      defaultIface = await si.networkInterfaceDefault()
      ifaceCheckedAt = Date.now()
    }
    const [n] = await si.networkStats(defaultIface)
    return { down: n?.rx_sec ?? null, up: n?.tx_sec ?? null }
  } catch {
    return { down: null, up: null }
  }
}

async function tick(): Promise<void> {
  if (busy) return
  busy = true
  try {
    const cpu = cpuPercent()
    const [mem, disk, net] = await Promise.all([readMemory(), readDisk(), readNet()])
    const sample: ResourceSample = {
      t: Date.now(),
      cpu,
      cores: os.cpus().length,
      memUsed: mem.used,
      memTotal: mem.total,
      diskRead: disk.read,
      diskWrite: disk.write,
      netDown: net.down,
      netUp: net.up
    }
    history.push(sample)
    if (history.length > HISTORY) history.shift()
    for (const wc of subscribers) if (!wc.isDestroyed()) wc.send(IPC.resSample, sample)
  } finally {
    busy = false
  }
}

function start(): void {
  if (timer) return
  void tick()
  timer = setInterval(() => void tick(), intervalMs)
}

function stop(): void {
  if (timer) clearInterval(timer)
  timer = null
}

function remove(wc: WebContents): void {
  subscribers.delete(wc)
  if (subscribers.size === 0) stop() // nobody is looking: no sampling, no cost
}

export function setSampleInterval(ms: number): void {
  intervalMs = ms
  if (timer) {
    stop()
    start()
  }
}

export function registerResourcesIpc(): void {
  ipcMain.handle(IPC.resSubscribe, (event) => {
    const wc = event.sender
    if (!subscribers.has(wc)) {
      subscribers.add(wc)
      wc.once('destroyed', () => remove(wc))
    }
    start()
    return [...history]
  })
  ipcMain.on(IPC.resUnsubscribe, (event) => remove(event.sender))
}
