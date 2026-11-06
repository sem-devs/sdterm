import { useCallback, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'sem-term:theme'
const THEME_EVENT = 'sem-term:theme-change'

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // storage unavailable: fall back to system
  }
  return 'system'
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(mode: ThemeMode): void {
  // Keeps prefers-color-scheme, the window background and the Windows caption buttons in step.
  window.api.setTheme(mode)
  const resolved = resolve(mode)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: resolved }))
}

// Call once before first render so there is no flash of the wrong theme.
export function initTheme(): void {
  apply(readStored())
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => readStored() === 'system' && apply('system'))
}

export function useTheme(): { mode: ThemeMode; setMode: (m: ThemeMode) => void } {
  const [mode, setModeState] = useState<ThemeMode>(readStored)
  const setMode = useCallback((m: ThemeMode) => {
    try {
      localStorage.setItem(KEY, m)
    } catch {
      // not persisted, still applied for this session
    }
    setModeState(m)
    apply(m)
  }, [])
  return { mode, setMode }
}

// Subscribe to the resolved theme (light/dark), e.g. to re-skin xterm.
export function onResolvedThemeChange(cb: () => void): () => void {
  window.addEventListener(THEME_EVENT, cb)
  return () => window.removeEventListener(THEME_EVENT, cb)
}
