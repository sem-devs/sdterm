import { app, BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WidgetKind } from '@shared/data'
import { openWidget } from './widgets'

/*
 * Development-only visual check. Off unless SDTERM_CAPTURE_DIR is set, and never active in a
 * packaged build. It opens the requested widgets, optionally runs a snippet in the main window
 * (e.g. to open a popover), screenshots every window to PNG, then quits.
 *
 *   SDTERM_CAPTURE_DIR   where to write the PNGs
 *   SDTERM_USER_DATA     separate userData dir, so captures never touch real settings
 *   SDTERM_OPEN_WIDGETS  comma separated widget kinds, e.g. "cpu,net"
 *   SDTERM_EVAL          JS run in the main window before capturing
 *   SDTERM_EVAL_TARGET     "widget" runs the snippet in the first pop-out instead of the main window
 *   SDTERM_EVAL_DELAY    ms to wait after the snippet (default 700)
 *   SDTERM_CAPTURE_DELAY ms after load before the first step (default 4500)
 */
export function runDevCapture(main: BrowserWindow): void {
  const dir = process.env.SDTERM_CAPTURE_DIR
  if (app.isPackaged || !dir) return
  mkdirSync(dir, { recursive: true })
  const delay = Number(process.env.SDTERM_CAPTURE_DELAY ?? 4500)

  main.webContents.once('did-finish-load', () => {
    const widgets = (process.env.SDTERM_OPEN_WIDGETS ?? '').split(',').filter(Boolean)
    for (const kind of widgets) openWidget(kind as WidgetKind)

    setTimeout(async () => {
      const code = process.env.SDTERM_EVAL
      if (code) {
        try {
          const target =
            process.env.SDTERM_EVAL_TARGET === 'widget'
              ? (BrowserWindow.getAllWindows().find((w) => w !== main) ?? main)
              : main
          const result: unknown = await target.webContents.executeJavaScript(code)
          if (result !== undefined) console.log('[capture] eval =>', JSON.stringify(result))
        } catch (err) {
          console.error('[capture] eval failed', err)
        }
        await new Promise((r) => setTimeout(r, Number(process.env.SDTERM_EVAL_DELAY ?? 700)))
      }
      for (const win of BrowserWindow.getAllWindows()) {
        const url = win.webContents.getURL()
        const name = /widget=([\w-]+)/.exec(url)?.[1] ?? 'main'
        const image = await win.webContents.capturePage()
        writeFileSync(join(dir, `${name}.png`), image.toPNG())
        console.log(`[capture] ${name}`)
      }
      app.quit()
    }, delay)
  })
}
