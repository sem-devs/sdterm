import type { ITheme } from '@xterm/xterm'

// The palette lives in CSS (--term-*) so the UI and the terminal can never drift apart.
export function readTerminalTheme(): ITheme {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string): string => css.getPropertyValue(`--term-${name}`).trim()
  return {
    background: v('bg'),
    foreground: v('fg'),
    cursor: v('cursor'),
    cursorAccent: v('bg'),
    selectionBackground: v('selection'),
    black: v('black'),
    red: v('red'),
    green: v('green'),
    yellow: v('yellow'),
    blue: v('blue'),
    magenta: v('magenta'),
    cyan: v('cyan'),
    white: v('white'),
    brightBlack: v('bright-black'),
    brightRed: v('bright-red'),
    brightGreen: v('bright-green'),
    brightYellow: v('bright-yellow'),
    brightBlue: v('bright-blue'),
    brightMagenta: v('bright-magenta'),
    brightCyan: v('bright-cyan'),
    brightWhite: v('bright-white')
  }
}
