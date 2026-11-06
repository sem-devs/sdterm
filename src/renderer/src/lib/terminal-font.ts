import type { Settings } from '@shared/settings'

const MONO_FALLBACK = 'ui-monospace, "SF Mono", Menlo, Consolas, "Cascadia Mono", monospace'

/** CSS font stack for the terminal, from the Terminal settings. */
export function terminalFontFamily(t: Settings['terminal']): string {
  if (t.font === 'system') return MONO_FALLBACK
  if (t.font === 'custom' && t.customFontFamily.trim()) {
    return `${t.customFontFamily.trim()}, ${MONO_FALLBACK}`
  }
  return `"Geist Mono Variable", ${MONO_FALLBACK}`
}
