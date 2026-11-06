import type { ThemeMode } from '@shared/settings'
import { useSettings } from '@/store/settings'

const THEME_EVENT = 'sdterm:theme-change'

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(mode: ThemeMode): void {
  const resolved = resolve(mode)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: resolved }))
}

// Call once before the first render so there is no flash of the wrong theme. The main process
// mirrors the same setting onto nativeTheme (window background, Windows caption buttons).
export function initTheme(): void {
  apply(useSettings.getState().settings.appearance.theme)
  useSettings.subscribe((state, prev) => {
    if (state.settings.appearance.theme !== prev.settings.appearance.theme) {
      apply(state.settings.appearance.theme)
    }
  })
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const mode = useSettings.getState().settings.appearance.theme
    if (mode === 'system') apply('system')
  })
}

// Subscribe to the resolved theme (light/dark), e.g. to re-skin xterm.
export function onResolvedThemeChange(cb: () => void): () => void {
  window.addEventListener(THEME_EVENT, cb)
  return () => window.removeEventListener(THEME_EVENT, cb)
}
