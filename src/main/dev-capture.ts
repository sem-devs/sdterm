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
 *   SDTERM_EVAL_TARGET     "widget" or "window:w2": run the snippet there instead of in main
 *   SDTERM_INSERT_TEXT     text committed into the focused field after the snippet (like dictation)
 *   SDTERM_CDP             JSON list of [method, params] sent to the main window's devtools protocol
 *   SDTERM_EVAL2           JS run after that text was inserted
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
          // "widget" = first pop-out; "window:w2" = that app window; default = main.
          const spec = process.env.SDTERM_EVAL_TARGET ?? ''
          const target =
            (spec &&
              BrowserWindow.getAllWindows().find((w) => {
                const url = w.webContents.getURL()
                return spec === 'widget'
                  ? url.includes('widget=')
                  : url.includes(`window=${spec.slice(7)}`)
              })) ||
            main
          const result: unknown = await target.webContents.executeJavaScript(code)
          if (result !== undefined) console.log('[capture] eval =>', JSON.stringify(result))
        } catch (err) {
          console.error('[capture] eval failed', err)
        }
        await new Promise((r) => setTimeout(r, Number(process.env.SDTERM_EVAL_DELAY ?? 700)))
      }
      // Raw Chromium input-method events (marked text, commit), e.g. [["Input.imeSetComposition", {...}]].
      const cdp = process.env.SDTERM_CDP
      if (cdp) {
        const dbg = main.webContents.debugger
        if (!dbg.isAttached()) dbg.attach('1.3')
        for (const [method, params] of JSON.parse(cdp) as Array<[string, object]>) {
          await dbg.sendCommand(method, params)
          await new Promise((r) => setTimeout(r, 250))
        }
        const code3 = process.env.SDTERM_EVAL2
        if (code3 && !process.env.SDTERM_INSERT_TEXT) {
          const result: unknown = await main.webContents.executeJavaScript(code3)
          if (result !== undefined) console.log('[capture] eval2 =>', JSON.stringify(result))
        }
      }
      // Text that arrives like dictation or an input method does: committed into the focused field.
      const insert = process.env.SDTERM_INSERT_TEXT
      if (insert) {
        main.webContents.insertText(insert)
        await new Promise((r) => setTimeout(r, 800))
        const code2 = process.env.SDTERM_EVAL2
        if (code2) {
          const result: unknown = await main.webContents.executeJavaScript(code2)
          if (result !== undefined) console.log('[capture] eval2 =>', JSON.stringify(result))
        }
      }
      for (const win of BrowserWindow.getAllWindows()) {
        const url = win.webContents.getURL()
        const name =
          /widget=([\w-]+)/.exec(url)?.[1] ?? `window-${/window=(\w+)/.exec(url)?.[1] ?? 'main'}`
        // A window behind others may not repaint, so bring it forward first.
        win.show()
        win.focus()
        await new Promise((r) => setTimeout(r, 500))
        const image = await win.webContents.capturePage()
        writeFileSync(join(dir, `${name}.png`), image.toPNG())
        console.log(`[capture] ${name}`)
      }
      app.quit()
    }, delay)
  })
}
