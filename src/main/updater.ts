import { app, ipcMain, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  accessSync,
  constants,
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { load } from 'js-yaml'
import { IPC } from '@shared/ipc'
import type { UpdateState } from '@shared/data'
import { getStore } from './store'
import { getAppWindows } from './windows'

/*
 * Self-update. The release script publishes latest.yml, latest-mac.yml and latest-linux.yml next to
 * the installers; the app compares the version in them with its own.
 *
 * Windows and Linux use electron-updater. macOS cannot: its updater only accepts apps signed with an
 * Apple Developer ID, and ours carries an ad-hoc signature, so the download, the integrity check and
 * the swap of the app bundle are done here. Once there is a Developer ID, macOS can move to
 * electron-updater too and the macOS branch below can go.
 */

const run = promisify(execFile)

const DEFAULT_FEED = 'https://55xxovadfasfy2ql.public.blob.vercel-storage.com/sdterm/updates'
const FEED_OVERRIDE = process.env.SDTERM_UPDATE_URL
const FEED = (FEED_OVERRIDE ?? DEFAULT_FEED).replace(/\/+$/, '')

// A development run never updates itself (it would replace Electron's own app), unless a test feed
// is given explicitly.
const ENABLED = app.isPackaged || Boolean(FEED_OVERRIDE)

const RECHECK_MS = 6 * 60 * 60 * 1000

let state: UpdateState = { status: 'idle' }
let busy = false
let mac: { version: string; url: string; sha512: string; size: number } | null = null

function setState(next: UpdateState): void {
  state = next
  for (const win of getAppWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send(IPC.updateState, state)
  }
}

const fail = (err: unknown): void => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[update]', message)
  setState({ status: 'error', message, version: state.version })
}

/** Is a newer than b? Compares the numbers of x.y.z and ignores any suffix. */
export function isNewer(a: string, b: string): boolean {
  const n = (v: string): number[] =>
    v
      .split('-')[0]
      .split('.')
      .map((p) => Number.parseInt(p, 10) || 0)
  const [x, y] = [n(a), n(b)]
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

// ---- macOS ---------------------------------------------------------------------------------------

interface LatestYml {
  version: string
  files?: Array<{ url: string; sha512: string; size: number }>
  releaseNotes?: string
}

async function checkMac(): Promise<void> {
  const res = await net.fetch(`${FEED}/latest-mac.yml?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Update feed answered ${res.status}`)
  const doc = load(await res.text()) as LatestYml
  if (!doc?.version || !isNewer(doc.version, app.getVersion())) {
    setState({ status: 'uptodate' })
    return
  }
  const file = doc.files?.find((f) => f.url.endsWith(`-mac-${process.arch}.zip`))
  if (!file) throw new Error(`No update for this Mac (${process.arch}) in the feed`)
  mac = {
    version: doc.version,
    url: `${FEED}/${encodeURI(file.url)}`,
    sha512: file.sha512,
    size: file.size
  }
  setState({ status: 'available', version: doc.version, notes: doc.releaseNotes })
}

/** The .app that is running, or null when this is not a packaged app we can replace. */
function runningBundle(): string | null {
  const bundle = app.getPath('exe').replace(/\/Contents\/MacOS\/[^/]+$/, '')
  return app.isPackaged && bundle.endsWith('.app') ? bundle : null
}

async function installMac(): Promise<void> {
  if (!mac) throw new Error('No update to install')
  const bundle = runningBundle()
  if (!bundle) throw new Error('Updates can only replace an installed app')
  if (bundle.includes('/AppTranslocation/')) {
    throw new Error('Move sdterm to the Applications folder, then open it from there to update')
  }
  try {
    accessSync(dirname(bundle), constants.W_OK)
  } catch {
    throw new Error(`No permission to replace the app in ${dirname(bundle)}`)
  }

  const work = join(app.getPath('temp'), 'sdterm-update')
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  const zip = join(work, 'update.zip')

  // Download, hashing as it arrives so a damaged or tampered file is never unpacked.
  const res = await net.fetch(mac.url)
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`)
  const total = Number(res.headers.get('content-length')) || mac.size
  const hash = createHash('sha512')
  const out = createWriteStream(zip)
  const reader = res.body.getReader()
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    hash.update(value)
    if (!out.write(value)) await new Promise<void>((resolve) => out.once('drain', () => resolve()))
    got += value.length
    setState({
      status: 'downloading',
      version: mac.version,
      percent: Math.min(99, Math.round((got / total) * 100))
    })
  }
  await new Promise<void>((resolve) => out.end(() => resolve()))
  if (hash.digest('base64') !== mac.sha512) throw new Error('The download is damaged. Try again.')

  await run('/usr/bin/ditto', ['-x', '-k', zip, work])
  const fresh = join(work, 'sdterm.app')
  if (!existsSync(join(fresh, 'Contents', 'Info.plist')))
    throw new Error('The update has no app inside')
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', fresh])

  // The swap happens after this process has exited, from a script that outlives it.
  const script = join(work, 'swap.sh')
  writeFileSync(
    script,
    `#!/bin/bash
PID="$1"; NEW="$2"; DEST="$3"; OLD="$DEST.previous"
for i in $(seq 1 200); do kill -0 "$PID" 2>/dev/null || break; sleep 0.3; done
rm -rf "$OLD"
if mv "$DEST" "$OLD"; then
  if mv "$NEW" "$DEST"; then rm -rf "$OLD"; else mv "$OLD" "$DEST"; fi
fi
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null
open "$DEST"
`,
    { mode: 0o755 }
  )
  spawn('/bin/bash', [script, String(process.pid), fresh, bundle], {
    detached: true,
    stdio: 'ignore'
  }).unref()
  setState({ status: 'ready', version: mac.version })
  setTimeout(() => app.quit(), 400)
}

// ---- Windows and Linux (electron-updater) --------------------------------------------------------

function setupAutoUpdater(): void {
  autoUpdater.setFeedURL({ provider: 'generic', url: FEED })
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('update-available', (info) => {
    const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    setState({ status: 'available', version: info.version, notes })
  })
  autoUpdater.on('update-not-available', () => setState({ status: 'uptodate' }))
  autoUpdater.on('download-progress', (p) =>
    setState({ status: 'downloading', version: state.version, percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', () => setState({ status: 'ready', version: state.version }))
  autoUpdater.on('error', fail)
}

// ---- Shared --------------------------------------------------------------------------------------

async function check(): Promise<void> {
  if (!ENABLED || busy) return
  busy = true
  setState({ status: 'checking' })
  try {
    if (process.platform === 'darwin') await checkMac()
    else await autoUpdater.checkForUpdates()
  } catch (err) {
    fail(err)
  } finally {
    busy = false
  }
}

async function install(): Promise<void> {
  if (!ENABLED || state.status !== 'available' || busy) return
  busy = true
  try {
    if (process.platform === 'darwin') await installMac()
    else {
      await autoUpdater.downloadUpdate()
      // Silent install, then start the new version.
      setImmediate(() => autoUpdater.quitAndInstall(true, true))
    }
  } catch (err) {
    fail(err)
  } finally {
    busy = false
  }
}

export function registerUpdater(): void {
  if (process.platform !== 'darwin') setupAutoUpdater()

  ipcMain.handle(IPC.updateGet, () => state)
  ipcMain.handle(IPC.updateCheck, () => check())
  ipcMain.handle(IPC.updateInstall, () => install())

  if (!ENABLED) return
  const auto = (): void => {
    if (getStore().settings.updates.autoCheck && state.status !== 'downloading') void check()
  }
  setTimeout(auto, 15_000) // not while the app is still starting up
  setInterval(auto, RECHECK_MS).unref()
}
