export const PANE_COLORS = [
  'cyan',
  'blue',
  'green',
  'amber',
  'orange',
  'rose',
  'violet',
  'graphite'
] as const
export type PaneColor = (typeof PANE_COLORS)[number]

export type ThemeMode = 'system' | 'light' | 'dark'
export type CursorStyle = 'bar' | 'block' | 'underline'
export type FontChoice = 'geist-mono' | 'system' | 'custom'
export type NetworkUnit = 'bytes' | 'bits'
export type SampleInterval = 1000 | 2000 | 5000

export interface Settings {
  /** Bumped when a default changes in a way existing files must pick up. */
  version: number
  appearance: {
    theme: ThemeMode
  }
  window: {
    /** Open as large as the screen, as a normal resizable window (not full-screen mode). */
    startMaximized: boolean
  }
  terminal: {
    font: FontChoice
    customFontFamily: string
    fontSize: number
    lineHeight: number
    cursorStyle: CursorStyle
    cursorBlink: boolean
    scrollback: number
    /** Empty means the platform default (login shell on macOS, PowerShell on Windows). */
    shell: string
    /** Empty means the home directory. */
    startDirectory: string
    optionAsMeta: boolean
    copyOnSelect: boolean
  }
  workspaces: {
    restoreOnLaunch: boolean
    autoColor: boolean
  }
  updates: {
    /** Look for a new version at startup and every few hours. */
    autoCheck: boolean
  }
  resources: {
    intervalMs: SampleInterval
    networkUnit: NetworkUnit
    popoutAlwaysOnTop: boolean
    showInSidebar: {
      cpu: boolean
      ram: boolean
      disk: boolean
      net: boolean
    }
  }
}

export const SETTINGS_VERSION = 2

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  appearance: { theme: 'system' },
  window: { startMaximized: true },
  terminal: {
    font: 'geist-mono',
    customFontFamily: '',
    fontSize: 13,
    lineHeight: 1.25,
    cursorStyle: 'block',
    cursorBlink: false,
    scrollback: 10_000,
    shell: '',
    startDirectory: '',
    // Off, like Terminal.app: Option types characters (@ # [ ] on Italian and many other layouts).
    optionAsMeta: false,
    copyOnSelect: false
  },
  workspaces: { restoreOnLaunch: true, autoColor: true },
  updates: { autoCheck: true },
  resources: {
    intervalMs: 2000,
    networkUnit: 'bytes',
    popoutAlwaysOnTop: true,
    showInSidebar: { cpu: true, ram: true, disk: true, net: true }
  }
}

// Keeps only keys that exist in the defaults and whose stored type matches, so a settings
// file from an older or newer version (or a hand edit) can never break the app.
function merge<T>(defaults: T, stored: unknown): T {
  if (defaults !== null && typeof defaults === 'object' && !Array.isArray(defaults)) {
    const src =
      stored !== null && typeof stored === 'object' ? (stored as Record<string, unknown>) : {}
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(defaults)) {
      out[key] = merge((defaults as Record<string, unknown>)[key], src[key])
    }
    return out as T
  }
  return typeof stored === typeof defaults ? (stored as T) : defaults
}

const clamp = (n: number, min: number, max: number): number =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min

const oneOf = <T>(value: T, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value) ? value : fallback

export function normalizeSettings(stored: unknown): Settings {
  const storedVersion =
    typeof (stored as { version?: unknown } | null)?.version === 'number'
      ? (stored as { version: number }).version
      : 1
  const s = merge(DEFAULT_SETTINGS, stored)
  // v2: Option no longer acts as Meta by default (it broke typing @ and # on an Italian keyboard).
  if (storedVersion < 2) s.terminal.optionAsMeta = false
  s.version = SETTINGS_VERSION
  s.appearance.theme = oneOf(s.appearance.theme, ['system', 'light', 'dark'], 'system')
  s.terminal.font = oneOf(s.terminal.font, ['geist-mono', 'system', 'custom'], 'geist-mono')
  s.terminal.cursorStyle = oneOf(s.terminal.cursorStyle, ['bar', 'block', 'underline'], 'bar')
  s.terminal.fontSize = clamp(s.terminal.fontSize, 9, 32)
  s.terminal.lineHeight = clamp(s.terminal.lineHeight, 1, 2)
  s.terminal.scrollback = clamp(Math.round(s.terminal.scrollback), 500, 200_000)
  s.terminal.customFontFamily = s.terminal.customFontFamily.slice(0, 200)
  s.terminal.shell = s.terminal.shell.slice(0, 500)
  s.terminal.startDirectory = s.terminal.startDirectory.slice(0, 1000)
  s.resources.intervalMs = oneOf(s.resources.intervalMs, [1000, 2000, 5000], 2000)
  s.resources.networkUnit = oneOf(s.resources.networkUnit, ['bytes', 'bits'], 'bytes')
  return s
}
