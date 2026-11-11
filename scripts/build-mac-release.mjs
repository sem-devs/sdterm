#!/usr/bin/env node
/**
 * Builds the macOS installers signed with a Developer ID certificate and notarized by Apple.
 * macOS then trusts the app, opens it without a warning and keeps its privacy permissions
 * (Documents, Desktop, Downloads) across updates, because the signature identifies SEM Devs
 * instead of one exact build.
 *
 * For maintainers. `npm run build:mac` stays ad hoc signed so anyone can build the app.
 *
 * One-time setup on the Mac that builds the release:
 *   1. A "Developer ID Application" certificate in the login keychain
 *      (Xcode, Settings, Accounts, pick the team, Manage Certificates, +).
 *   2. Notary credentials stored in the keychain (it asks for an app-specific password):
 *        xcrun notarytool store-credentials "sdterm-notary" --apple-id <Apple ID> --team-id <TEAM ID>
 *
 * Optional environment:
 *   SDTERM_SIGN_IDENTITY     pick a certificate by name when the keychain has several
 *   APPLE_KEYCHAIN_PROFILE   notary profile name (default: sdterm-notary)
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const PROFILE = process.env.APPLE_KEYCHAIN_PROFILE || 'sdterm-notary'

const fail = (message) => {
  console.error(`\n${message}\n`)
  process.exit(1)
}

const run = (cmd, args, env = process.env) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', env })
  if (result.status !== 0) fail(`Failed: ${cmd} ${args.join(' ')}`)
}

if (process.platform !== 'darwin') fail('The signed macOS build only runs on a Mac.')

// 1. The certificate. Never fall back to ad hoc or to an "Apple Development" certificate: those
// would produce an installer that looks signed but is not one macOS trusts.
let identities = ''
try {
  identities = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
    encoding: 'utf8'
  })
} catch {
  // handled below
}
const names = [...identities.matchAll(/"(Developer ID Application: [^"]+)"/g)].map((m) => m[1])
const wanted = process.env.SDTERM_SIGN_IDENTITY
const identity = wanted ? names.find((n) => n.includes(wanted)) : names[0]
if (!identity) {
  fail(
    'No "Developer ID Application" certificate found in the keychain.\n' +
      'Create one in Xcode: Settings, Accounts, pick the team, Manage Certificates, +,\n' +
      'Developer ID Application (only the Account Holder can).'
  )
}

// 2. The notary credentials. A quick call to Apple proves they work before a long build.
const check = spawnSync('xcrun', ['notarytool', 'history', '--keychain-profile', PROFILE], {
  encoding: 'utf8'
})
if (check.status !== 0) {
  fail(
    `The notary profile "${PROFILE}" is missing or not accepted by Apple.\n` +
      'Create it once (it asks for an app-specific password from appleid.apple.com):\n' +
      `  xcrun notarytool store-credentials "${PROFILE}" --apple-id <Apple ID> --team-id <TEAM ID>\n\n` +
      (check.stderr || '').trim()
  )
}

console.log(`Signing with: ${identity}\nNotary profile: ${PROFILE}\n`)

// 3. Build, sign (hardened runtime) and notarize.
run('npm', ['run', 'typecheck'])
run('npx', ['--no-install', 'electron-vite', 'build'])
run(
  'npx',
  [
    '--no-install',
    'electron-builder',
    '--mac',
    '--publish',
    'never',
    `-c.mac.identity=${identity.replace(/^Developer ID Application: /, '')}`,
    '-c.mac.hardenedRuntime=true',
    '-c.mac.notarize=true'
  ],
  { ...process.env, APPLE_KEYCHAIN_PROFILE: PROFILE }
)

// 4. Do not trust the build: ask macOS what it thinks of each app it produced.
let problems = 0
for (const app of ['dist/mac-arm64/sdterm.app', 'dist/mac/sdterm.app']) {
  if (!existsSync(app)) continue
  const checks = [
    ['codesign', ['--verify', '--deep', '--strict', app]],
    ['spctl', ['--assess', '--type', 'execute', '--verbose=2', app]],
    ['xcrun', ['stapler', 'validate', app]]
  ]
  for (const [cmd, args] of checks) {
    const r = spawnSync(cmd, args, { encoding: 'utf8' })
    const ok = r.status === 0
    if (!ok) problems++
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${cmd} ${args[0]} ${app}`)
    if (!ok) console.log(`     ${(r.stderr || r.stdout).trim().split('\n').join('\n     ')}`)
  }
}
if (problems > 0) fail(`${problems} check(s) failed: do not publish this build.`)
console.log('\nSigned and notarized. Next: npm run publish:update, as usual.')
