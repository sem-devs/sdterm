# sdterm

A local terminal workspace: many terminals, one window. Mac and Windows.

Work in progress. It runs real shells (zsh on macOS, PowerShell on Windows) in a split grid, with workspaces that keep their terminals alive while you switch between them.

## Features

- **Projects that stay open.** Every workspace is a project with its own folder. Everything is restored at launch: workspaces, terminals, names, notes, colors, and each terminal starts again in the folder it was in. Terminals are tied to the app, not to a window, so they survive moving a workspace between windows.
- **Park what you are not working on.** Park a workspace to stop its shells (it warns if something is still running) while keeping names, notes, colors and folders. Launch it again with one click. Parked workspaces collapse into their own group.
- **More than one window.** Move a workspace to another window (or a new one) from its menu; the layout is saved and restored. Closing an extra window hands its workspaces back to the main one.
- **Rename, delete, set the project folder** from each workspace's menu, and open any terminal's folder in Finder or Explorer.
- **Processes window** like Activity Monitor or Resource Monitor: top CPU and memory users, grouped by name, sortable and filterable.
- **Name, note and color per terminal.** Click a terminal's title bar to say what it is for and where you left off. The note shows in the title bar and in the sidebar overview, and everything is saved between launches.
- **Resource monitors you can pop out.** CPU, RAM, CPU and RAM together, disk I/O and network I/O, docked in the sidebar. Each one (or the whole summary) opens as its own small window that you can place anywhere, keep on top, and that remembers its position.
- **Windows that behave.** The main window opens as large as the screen but is a normal window (no full-screen mode, resizable by dragging). Pop-outs resize by dragging any edge or the corner handle, and have a button to fill the screen and go back.
- **Settings for everything personal.** Theme, terminal font, size, cursor, scrollback, shell, start directory, sidebar metrics, units and more, applied live. Open them with Cmd+, (Ctrl+Shift+, on Windows).
- **SEM Devs branding** from the brand book: logo, palette and fonts (Space Grotesk, Inter).

## Stack

- Electron + Vite (electron-vite), React 19, TypeScript
- Tailwind CSS v4 + shadcn/ui, restyled to the SEM Devs brand (cyan on dark, Tech Blue on light; Space Grotesk, Inter, Geist Mono for the terminal)
- xterm.js (WebGL renderer) + node-pty
- zustand for workspace and settings state, saved as JSON in the app's user data folder
- systeminformation for disk and network throughput

## Develop

```bash
npm install
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

## Install

Installers are built for every platform with the "Build installers" workflow (GitHub, Actions): run it by hand, or push a tag such as `v1.0.2` to also get a draft release.

| Platform | File                                                                     | Notes                                                                                                    |
| -------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| macOS    | `sdterm-<version>-mac-arm64.dmg` (Apple Silicon), `-mac-x64.dmg` (Intel) | Open the DMG, drag sdterm to Applications. See below.                                                    |
| Windows  | `sdterm-<version>-win-x64-setup.exe` (`-arm64-` for ARM)                 | Run the installer.                                                                                       |
| Linux    | `sdterm-<version>-linux-x64.AppImage` or `.deb`                          | AppImage: `chmod +x` and run. On Ubuntu 24.04 the AppImage may need `--no-sandbox`; the `.deb` does not. |

The builds are not signed with a developer certificate yet, so the first launch shows a warning:

- macOS: right-click the app, choose Open, then Open again (or run `xattr -dr com.apple.quarantine /Applications/sdterm.app`).
- Windows: SmartScreen shows "Windows protected your PC": choose More info, then Run anyway.

Signing needs an Apple Developer ID certificate and a Windows code-signing certificate; set `mac.identity` and `notarize` in `electron-builder.yml` when they exist.

## Build locally

```bash
npm run build:mac   # DMG and ZIP, Apple Silicon and Intel (needs macOS)
npm run build:win   # NSIS installer (x64, ARM64)
npm run build:linux # AppImage and deb (needs Linux: node-pty is compiled there)
```

Output goes to `dist/`. Version 1.0.2.

## Shortcuts

| Action         | macOS | Windows      |
| -------------- | ----- | ------------ |
| New terminal   | Cmd+T | Ctrl+Shift+T |
| Close terminal | Cmd+W | Ctrl+Shift+W |
| New workspace  | Cmd+N | Ctrl+Shift+N |

On Windows, Ctrl+Shift+C and Ctrl+Shift+V copy and paste. Plain Ctrl+C copies only when text is selected, otherwise it interrupts the running process.

## Layout

```
src/main      Electron main process: windows, menu, PTY manager, settings store, resource sampler
src/preload   contextBridge API (sandboxed)
src/shared    IPC contract shared by main, preload and renderer
src/renderer  React app (components, store, theme)
```

## Visual checks

`SDTERM_CAPTURE_DIR=/some/dir npm start` opens the app, screenshots every window to PNG and quits (development only; see `src/main/dev-capture.ts` for the other variables).

## Status

Tested on macOS only. Windows (ConPTY, title bar overlay, copy and paste) is implemented but not yet run on a real machine. Disk I/O is not reported on Windows yet and shows n/a.
