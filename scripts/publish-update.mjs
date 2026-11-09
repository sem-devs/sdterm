#!/usr/bin/env node
/**
 * Publishes a built version so installed apps can find and install it.
 *
 *   BLOB_READ_WRITE_TOKEN=... node scripts/publish-update.mjs [dist-folder]
 *
 * Uploads the installers named in latest.yml, latest-mac.yml and latest-linux.yml, then the three
 * yml files themselves. The ymls go last, so an app never reads one that points to a file that is
 * not there yet, and they are cached for one minute only so a release shows up quickly.
 * The folder must come from `npm run build:mac` / `build:win` / `build:linux` (default: dist).
 */
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { put } from '@vercel/blob'
import { load } from 'js-yaml'

const token = process.env.BLOB_READ_WRITE_TOKEN
const dist = resolve(process.argv[2] ?? 'dist')
if (!token) {
  console.error('Set BLOB_READ_WRITE_TOKEN to the token of the site Blob store.')
  process.exit(1)
}

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const ymls = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml'].filter((f) =>
  existsSync(join(dist, f))
)
if (ymls.length === 0) {
  console.error(`No latest*.yml in ${dist}. Build first.`)
  process.exit(1)
}

const upload = async (file, cacheControlMaxAge) => {
  const blob = await put(`sdterm/updates/${file}`, createReadStream(join(dist, file)), {
    access: 'public',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    multipart: true,
    contentType: file.endsWith('.yml') ? 'text/yaml; charset=utf-8' : 'application/octet-stream',
    cacheControlMaxAge
  })
  console.log(`  ${blob.url}`)
}

const installers = new Set()
for (const yml of ymls) {
  const doc = load(readFileSync(join(dist, yml), 'utf8'))
  if (doc.version !== version) {
    console.error(`${yml} is for ${doc.version} but package.json says ${version}. Rebuild.`)
    process.exit(1)
  }
  for (const f of doc.files ?? []) installers.add(f.url)
}

for (const file of installers) {
  if (!existsSync(join(dist, file))) {
    console.warn(`Skipping ${file}: not built here`)
    continue
  }
  console.log(`Uploading ${file}`)
  await upload(file, 31536000)
}
for (const yml of ymls) {
  console.log(`Publishing ${yml}`)
  await upload(yml, 60)
}
console.log(
  `Version ${version} is out. Installed apps will see it within a few hours, or on Check now.`
)
