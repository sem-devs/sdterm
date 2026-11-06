import type { PaneColor } from '@shared/settings'

/** CSS value for a pane colour; terminals without one use the brand accent. */
export const paneColorVar = (color: PaneColor | null): string =>
  color ? `var(--pane-${color})` : 'var(--primary)'
