# Development notes

## Stack

Electron (electron-vite), React 19, TypeScript, Tailwind CSS v4 with shadcn/ui, xterm.js with node-pty,
zustand for state. Disk, network and process numbers come from systeminformation; CPU and RAM are read
directly (RAM on macOS uses `vm_stat`, the same figure as Activity Monitor).

## How it is organized

```
src/main      Electron main process: windows, menu, shells, settings store, resource sampler, updater
src/preload   the sandboxed bridge between the main process and the pages
src/shared    types and the IPC contract used by all three
src/renderer  the React app
```

The main idea: **shells belong to the main process, not to a window.** A window attaches to a terminal's
shell and detaches again, and the recent output is replayed. That is why a workspace can move to another
window, or survive a window closing, without losing its processes.

Settings, workspaces, names, notes, colors and window positions are one JSON file in the app's user data
folder (`sdterm.json`).

## Checking the interface without clicking

In development the app can screenshot its own windows and run a snippet inside them:

```bash
SDTERM_CAPTURE_DIR=/tmp/shots SDTERM_USER_DATA=/tmp/data SDTERM_OPEN_WIDGETS=cpu \
SDTERM_EVAL="document.title" npm run dev
```

The other variables are listed in `src/main/dev-capture.ts`. Always point `SDTERM_USER_DATA` at a scratch
folder so your real settings are never touched. Test in `npm run dev` as well as in a built app: React
mounts components twice in development, which exposes bugs a production build hides.

## Releasing

1. Bump `version` in `package.json`.
2. Build: `npm run build:mac` and `npm run build:win` work on a Mac. `npm run build:linux` needs Linux
   (node-pty has no prebuilt Linux binary), for example the "Build installers" workflow on GitHub.
3. Put the installers on the website (`scripts/upload-sdterm-downloads.mjs` in the site repo).
4. Publish the update for installed apps: `BLOB_READ_WRITE_TOKEN=... npm run publish:update`. It uploads
   the installers and then `latest*.yml`, which is what running apps check.
5. Create the GitHub release with the same files.

The macOS build is signed ad hoc, so macOS updates are done by the app itself (download, check, swap the
app, reopen). With an Apple Developer ID certificate, set `mac.identity` and `notarize` in
`electron-builder.yml` and macOS can use the standard updater like the other platforms.
