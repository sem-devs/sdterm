# SEM Term

A local terminal workspace: many terminals, one window. Mac and Windows.

Work in progress. Today it runs real shells (zsh on macOS, PowerShell on Windows) in a split grid, with workspaces that keep their terminals alive while you switch between them.

## Stack

- Electron + Vite (electron-vite), React 19, TypeScript
- Tailwind CSS v4 + shadcn/ui, restyled (Geist and Geist Mono, one ember accent, light and dark)
- xterm.js (WebGL renderer) + node-pty
- zustand for workspace state

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
src/main      Electron main process: window, menu, PTY manager
src/preload   contextBridge API (sandboxed)
src/shared    IPC contract shared by main, preload and renderer
src/renderer  React app (components, store, theme)
```

## Status

Tested on macOS only. Windows (ConPTY, title bar overlay, copy and paste) is implemented but not yet run on a real machine.
