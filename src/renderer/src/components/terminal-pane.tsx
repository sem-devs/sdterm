import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { readTerminalTheme } from '@/lib/terminal-theme'
import { onResolvedThemeChange } from '@/hooks/use-theme'
import { useWorkspaces } from '@/store/workspace'

const FONT = '"Geist Mono Variable", ui-monospace, "SF Mono", Menlo, Consolas, monospace'
const isMac = window.api.platform === 'darwin'

interface Props {
  paneId: string
  focused: boolean
}

export function TerminalPane({ paneId, focused }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    const host = hostRef.current!
    const { pty } = window.api

    const term = new Terminal({
      fontFamily: FONT,
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 10_000,
      cursorStyle: 'bar',
      macOptionIsMeta: true,
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

    pty.create({ cols: term.cols, rows: term.rows }).then(({ id }) => {
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
        term.onTitleChange((title) => title && useWorkspaces.getState().setPaneTitle(paneId, title))
          .dispose
      )
      // The pane may have been resized while the shell was starting.
      pty.resize(id, term.cols, term.rows)
    })

    let raf = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => fit.fit())
    })
    observer.observe(host)

    // Cell size depends on the font, so re-measure once Geist Mono has actually loaded.
    void document.fonts.load('13px "Geist Mono Variable"').then(() => {
      if (disposed) return
      term.options.fontFamily = FONT
      fit.fit()
    })

    const offTheme = onResolvedThemeChange(() => {
      term.options.theme = readTerminalTheme()
    })

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
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
