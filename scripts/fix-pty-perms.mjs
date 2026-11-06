// node-pty 1.x ships its macOS spawn-helper without the executable bit,
// which makes every spawn fail with "posix_spawnp failed". Fix it after install.
import { chmodSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const prebuilds = join(import.meta.dirname, '..', 'node_modules', 'node-pty', 'prebuilds')
if (existsSync(prebuilds)) {
  for (const dir of readdirSync(prebuilds)) {
    if (!dir.startsWith('darwin-')) continue
    const helper = join(prebuilds, dir, 'spawn-helper')
    if (existsSync(helper)) chmodSync(helper, 0o755)
  }
}
