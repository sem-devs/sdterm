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

## Package

```bash
npm run build:mac   # .dmg
npm run build:win   # .exe installer
```

Builds are unsigned. macOS Gatekeeper and Windows SmartScreen will warn until signing is set up.

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
