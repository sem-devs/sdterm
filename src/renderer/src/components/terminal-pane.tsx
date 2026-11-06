import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
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
}

type TerminalSettings = Settings['terminal']

function applySettings(term: Terminal, fit: FitAddon, t: TerminalSettings): void {
  term.options.fontFamily = terminalFontFamily(t)
  term.options.fontSize = t.fontSize
  term.options.lineHeight = t.lineHeight
  term.options.cursorStyle = t.cursorStyle
  term.options.cursorBlink = t.cursorBlink
  term.options.scrollback = t.scrollback
  term.options.macOptionIsMeta = t.optionAsMeta
  fit.fit() // cell size changed
}

export function TerminalPane({ paneId, focused }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    const host = hostRef.current!
    const { pty } = window.api
    const cfg = useSettings.getState().settings.terminal

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
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch {
      // WebGL unavailable: xterm falls back to the DOM renderer
    }
    fit.fit()
    termRef.current = term

    // Windows/Linux copy and paste. On macOS the Edit menu handles Cmd+C/V.
    if (!isMac) {
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== 'keydown' || !e.ctrlKey) return true
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
    }

    let ptyId: string | null = null
    let disposed = false
    const cleanups: Array<() => void> = []

    pty
      .create({
        cols: term.cols,
        rows: term.rows,
        shell: cfg.shell || undefined,
        cwd: cfg.startDirectory || undefined
      })
      .then(({ id }) => {
        if (disposed) {
          pty.kill(id)
          return
        }
        ptyId = id
        cleanups.push(
          pty.onData((pid, data) => pid === id && term.write(data)),
          pty.onExit((pid) => pid === id && useWorkspaces.getState().closePane(paneId)),
          term.onData((data) => pty.write(id, data)).dispose,
          term.onResize(({ cols, rows }) => pty.resize(id, cols, rows)).dispose,
          term.onTitleChange((title) => useWorkspaces.getState().setAutoTitle(paneId, title))
            .dispose
        )
        // The pane may have been resized while the shell was starting.
        pty.resize(id, term.cols, term.rows)
      })

    cleanups.push(
      term.onSelectionChange(() => {
        if (useSettings.getState().settings.terminal.copyOnSelect && term.hasSelection()) {
          void navigator.clipboard.writeText(term.getSelection())
        }
      }).dispose
    )

    let raf = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => fit.fit())
    })
    observer.observe(host)

    // Cell size depends on the font, so re-measure once the bundled font has actually loaded.
    void document.fonts.load(`${cfg.fontSize}px "Geist Mono Variable"`).then(() => {
      if (!disposed) applySettings(term, fit, useSettings.getState().settings.terminal)
    })

    // Settings changes apply to live terminals immediately.
    const offSettings = useSettings.subscribe((state, prev) => {
      if (state.settings.terminal !== prev.settings.terminal) {
        applySettings(term, fit, state.settings.terminal)
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
      if (ptyId) pty.kill(ptyId)
      term.dispose()
      termRef.current = null
    }
  }, [paneId])

  useEffect(() => {
    if (focused) termRef.current?.focus()
  }, [focused])

  return <div ref={hostRef} className="h-full min-h-0 w-full min-w-0 overflow-hidden" />
}
