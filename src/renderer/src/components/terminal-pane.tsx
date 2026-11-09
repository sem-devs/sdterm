import { useEffect, useRef } from 'react'
import { Terminal, type IDisposable } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import type { Settings } from '@shared/settings'
import { readTerminalTheme } from '@/lib/terminal-theme'
import { terminalFontFamily } from '@/lib/terminal-font'
import { onResolvedThemeChange } from '@/hooks/use-theme'
import { useSettings } from '@/store/settings'
import { useWorkspaces } from '@/store/workspace'

const isMac = window.api.platform === 'darwin'

interface Props {
  paneId: string
  focused: boolean
  /** Only visible terminals use the GPU renderer: browsers allow few WebGL contexts. */
  visible: boolean
  /** Where a brand new shell starts (the workspace's project folder), if known. */
  cwd?: string
}

type TerminalSettings = Settings['terminal']

function applySettings(term: Terminal, refit: () => void, t: TerminalSettings): void {
  term.options.fontFamily = terminalFontFamily(t)
  term.options.fontSize = t.fontSize
  term.options.lineHeight = t.lineHeight
  term.options.cursorStyle = t.cursorStyle
  term.options.cursorBlink = t.cursorBlink
  term.options.scrollback = t.scrollback
  term.options.macOptionIsMeta = t.optionAsMeta
  refit() // cell size changed
}

// Shells that know about it announce their folder: OSC 7 (file://host/path), and OSC 9;9 as
// used by Windows Terminal and prompts like oh-my-posh and starship.
function folderFromOsc7(data: string): string | null {
  try {
    const url = new URL(data)
    if (url.protocol !== 'file:') return null
    const path = decodeURIComponent(url.pathname)
    return /^\/[A-Za-z]:/.test(path) ? path.slice(1) : path
  } catch {
    return null
  }
}

/** A path as one shell word: plain paths are left alone, anything else is single-quoted. */
function shellQuote(path: string): string {
  return /^[\w@%+=:,./-]+$/.test(path) ? path : `'${path.replace(/'/g, `'\\''`)}'`
}

export function TerminalPane({ paneId, focused, visible, cwd }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const gpuRef = useRef<((on: boolean) => void) | null>(null)
  const visibleRef = useRef(visible)
  const cwdRef = useRef(cwd)

  // Declared before the main effect, so the refs are current when the terminal is created.
  useEffect(() => {
    visibleRef.current = visible
    cwdRef.current = cwd
  })

  useEffect(() => {
    const host = hostRef.current!
    const { pty } = window.api
    const cfg = useSettings.getState().settings.terminal
    const viewId = crypto.randomUUID()

    const term = new Terminal({
      fontFamily: terminalFontFamily(cfg),
      fontSize: cfg.fontSize,
      lineHeight: cfg.lineHeight,
      scrollback: cfg.scrollback,
      cursorStyle: cfg.cursorStyle,
      cursorBlink: cfg.cursorBlink,
      macOptionIsMeta: cfg.optionAsMeta,
      allowProposedApi: true,
      theme: readTerminalTheme()
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(host)
    // A hidden terminal (a workspace in the background) has no size. Fitting it would shrink the
    // shell to a handful of columns, so the prompt wraps and output is laid out for 9 columns.
    const hasSize = (): boolean => host.clientWidth > 80 && host.clientHeight > 40
    const refit = (): void => {
      if (hasSize()) fit.fit()
    }
    refit()
    if (!hasSize()) term.resize(120, 32) // a sane size to start the shell at until it is shown
    termRef.current = term

    let webgl: WebglAddon | null = null
    gpuRef.current = (on: boolean): void => {
      if (on && !webgl) {
        try {
          const addon = new WebglAddon()
          addon.onContextLoss(() => {
            addon.dispose()
            if (webgl === addon) webgl = null
          })
          term.loadAddon(addon)
          webgl = addon
        } catch {
          // WebGL unavailable: xterm keeps its DOM renderer
        }
      } else if (!on && webgl) {
        webgl.dispose()
        webgl = null
      }
    }
    gpuRef.current(visibleRef.current)

    // Keys, as the platform's own terminal behaves.
    const send = (data: string): boolean => {
      pty.write(paneId, data)
      return false // handled: xterm must not process the key as well
    }
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (isMac) {
        // The text-editing shortcuts macOS users expect from Terminal.app.
        if (e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey) {
          if (e.key === 'ArrowLeft') return send('\x01') // start of line
          if (e.key === 'ArrowRight') return send('\x05') // end of line
          if (e.key === 'Backspace') return send('\x15') // delete to start of line
          if (e.key === 'k') {
            term.clear()
            return send('\x0c') // clear, then redraw the prompt
          }
        }
        if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
          if (e.key === 'ArrowLeft') return send('\x1bb') // back one word
          if (e.key === 'ArrowRight') return send('\x1bf') // forward one word
          if (e.key === 'Backspace') return send('\x17') // delete previous word
          if (e.key === 'Delete') return send('\x1bd') // delete next word
        }
        return true // Cmd+C and Cmd+V come from the Edit menu
      }
      // Windows/Linux: Ctrl+Shift+C/V, and Ctrl+C copies only when text is selected.
      if (!e.ctrlKey) return true
      const key = e.key.toLowerCase()
      if (key === 'c' && (e.shiftKey || term.hasSelection())) {
        void navigator.clipboard.writeText(term.getSelection())
        term.clearSelection()
        return false
      }
      if (key === 'v' && e.shiftKey) {
        void navigator.clipboard.readText().then((t) => term.paste(t))
        return false
      }
      return true
    })

    let disposed = false
    const cleanups: Array<() => void> = []
    const own = (d: IDisposable): void => {
      cleanups.push(() => d.dispose())
    }

    own(
      term.parser.registerOscHandler(7, (data) => {
        const dir = folderFromOsc7(data)
        if (dir) pty.reportCwd(paneId, dir)
        return true
      })
    )
    own(
      term.parser.registerOscHandler(9, (data) => {
        if (!data.startsWith('9;')) return false // other OSC 9 uses (notifications)
        pty.reportCwd(paneId, data.slice(2).replace(/^"|"$/g, ''))
        return true
      })
    )

    // Dictation, the emoji picker and voice typing put text into the terminal without a character
    // key behind it. xterm drops such text if it saw a key go down and never come back up, which is
    // exactly what happens with the key that starts dictation, so the text vanishes. Forward it here.
    // Ordinary typing (a printable keydown) and input-method composition are left to xterm.
    const input = term.textarea
    if (input) {
      let printableDown = false
      let composing = false
      let composedAt = 0
      const onKeyDown = (e: KeyboardEvent): void => {
        printableDown = [...e.key].length === 1 && !e.ctrlKey && !e.metaKey
      }
      const onKeyUp = (): void => {
        printableDown = false
      }
      const onCompositionStart = (): void => {
        composing = true
      }
      const onCompositionEnd = (): void => {
        composing = false
        composedAt = Date.now()
      }
      const onBeforeInput = (e: InputEvent): void => {
        if (e.inputType !== 'insertText' || !e.data) return
        if (printableDown || composing || e.isComposing || Date.now() - composedAt < 60) return
        e.preventDefault()
        term.input(e.data)
      }
      input.addEventListener('keydown', onKeyDown, true)
      input.addEventListener('keyup', onKeyUp, true)
      input.addEventListener('compositionstart', onCompositionStart, true)
      input.addEventListener('compositionend', onCompositionEnd, true)
      input.addEventListener('beforeinput', onBeforeInput, true)
      cleanups.push(() => {
        input.removeEventListener('keydown', onKeyDown, true)
        input.removeEventListener('keyup', onKeyUp, true)
        input.removeEventListener('compositionstart', onCompositionStart, true)
        input.removeEventListener('compositionend', onCompositionEnd, true)
        input.removeEventListener('beforeinput', onBeforeInput, true)
      })
    }

    // Right-click menu, like the system terminal.
    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault()
      void window.api.app.terminalMenu(term.hasSelection()).then((choice) => {
        if (choice === 'copy') void navigator.clipboard.writeText(term.getSelection())
        if (choice === 'paste') void navigator.clipboard.readText().then((t) => term.paste(t))
        if (choice === 'select-all') term.selectAll()
        if (choice === 'clear') {
          term.clear()
          pty.write(paneId, '\x0c')
        }
      })
    }
    host.addEventListener('contextmenu', onContextMenu)
    cleanups.push(() => host.removeEventListener('contextmenu', onContextMenu))

    // Dropping files or folders types their paths, quoted for the shell.
    const onDragOver = (e: DragEvent): void => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    const onDrop = (e: DragEvent): void => {
      const files = [...(e.dataTransfer?.files ?? [])]
      if (files.length === 0) return
      e.preventDefault()
      term.paste(files.map((f) => shellQuote(window.api.app.pathForFile(f))).join(' ') + ' ')
      term.focus()
    }
    host.addEventListener('dragover', onDragOver)
    host.addEventListener('drop', onDrop)
    cleanups.push(() => {
      host.removeEventListener('dragover', onDragOver)
      host.removeEventListener('drop', onDrop)
    })

    // Attach to this pane's shell: starts it, or picks up the one already running (for example
    // after the workspace moved here from another window) and repaints its recent output.
    void pty
      .attach({
        paneId,
        viewId,
        cols: term.cols,
        rows: term.rows,
        shell: cfg.shell || undefined,
        cwd: cwdRef.current || cfg.startDirectory || undefined
      })
      .then(({ replay }) => {
        if (disposed) {
          pty.detach(paneId, viewId)
          return
        }
        if (replay) term.write(replay)
        cleanups.push(
          pty.onData(paneId, (data) => term.write(data)),
          pty.onExit(paneId, () => useWorkspaces.getState().closePane(paneId))
        )
        own(term.onData((data) => pty.write(paneId, data)))
        own(term.onResize(({ cols, rows }) => pty.resize(paneId, cols, rows)))
        own(term.onTitleChange((title) => useWorkspaces.getState().setAutoTitle(paneId, title)))
        // The view may have a different size than the shell had.
        pty.resize(paneId, term.cols, term.rows)
      })

    own(
      term.onSelectionChange(() => {
        if (useSettings.getState().settings.terminal.copyOnSelect && term.hasSelection()) {
          void navigator.clipboard.writeText(term.getSelection())
        }
      })
    )

    let raf = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(refit)
    })
    observer.observe(host)

    // Cell size depends on the font, so re-measure once the bundled font has actually loaded.
    void document.fonts.load(`${cfg.fontSize}px "Geist Mono Variable"`).then(() => {
      if (!disposed) applySettings(term, refit, useSettings.getState().settings.terminal)
    })

    // Settings changes apply to live terminals immediately.
    const offSettings = useSettings.subscribe((state, prev) => {
      if (state.settings.terminal !== prev.settings.terminal) {
        applySettings(term, refit, state.settings.terminal)
      }
    })

    const offTheme = onResolvedThemeChange(() => {
      term.options.theme = readTerminalTheme()
    })

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      offSettings()
      offTheme()
      cleanups.forEach((fn) => fn())
      // Detach, do not kill: the shell belongs to the pane, not to this view. It is ended only
      // when the terminal is closed or its workspace is parked or deleted.
      pty.detach(paneId, viewId)
      gpuRef.current?.(false)
      gpuRef.current = null
      term.dispose()
      termRef.current = null
    }
  }, [paneId])

  useEffect(() => {
    gpuRef.current?.(visible)
  }, [visible])

  useEffect(() => {
    if (focused && visible) termRef.current?.focus()
  }, [focused, visible])

  return <div ref={hostRef} className="h-full min-h-0 w-full min-w-0 overflow-hidden" />
}
