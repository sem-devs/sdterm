import type { LayoutId } from '@shared/data'

/** Carries a terminal's id while it is dragged to another position or workspace. */
export const PANE_MIME = 'application/x-sdterm-pane'

export const LAYOUT_LABELS: Record<LayoutId, string> = {
  auto: 'Auto',
  columns: 'Columns',
  rows: 'Rows',
  grid: 'Grid',
  'main-left': 'Main on the left',
  'main-right': 'Main on the right',
  'main-top': 'Main on top'
}

export interface LayoutResult {
  /** CSS grid-template-columns / rows. */
  cols: string
  rows: string
  /** Where each terminal goes, in the order of the workspace's terminals. */
  cells: Array<{ col: string; row: string }>
  /** The divider you can drag: along x (between columns) or y (between rows), if any. */
  axis: 'x' | 'y' | null
  /** Position of that divider as a fraction from the left/top edge. */
  dividerAt: number
  /** True when dragging towards the start grows the main area (main on the right). */
  fromEnd: boolean
}

const fr = (n: number): string => `minmax(0, ${n}fr)`
const equal = (n: number): string => `repeat(${n}, minmax(0, 1fr))`

/** What "auto" means for a given number of terminals. */
export function resolveLayout(layout: LayoutId, count: number): Exclude<LayoutId, 'auto'> {
  if (layout !== 'auto') return layout
  if (count <= 2) return 'columns'
  if (count === 3) return 'main-left'
  return 'grid'
}

export function computeLayout(layout: LayoutId, count: number, split: number | null): LayoutResult {
  const n = Math.max(count, 1)
  const base = { axis: null, dividerAt: 0.5, fromEnd: false } as const
  if (n === 1) {
    return { ...base, cols: fr(1), rows: fr(1), cells: [{ col: '1', row: '1' }] }
  }

  switch (resolveLayout(layout, n)) {
    case 'columns': {
      const s = n === 2 ? (split ?? 0.5) : null
      return {
        ...base,
        cols: s === null ? equal(n) : `${fr(s)} ${fr(1 - s)}`,
        rows: fr(1),
        cells: Array.from({ length: n }, (_, i) => ({ col: `${i + 1}`, row: '1' })),
        axis: s === null ? null : 'x',
        dividerAt: s ?? 0.5
      }
    }
    case 'rows': {
      const s = n === 2 ? (split ?? 0.5) : null
      return {
        ...base,
        cols: fr(1),
        rows: s === null ? equal(n) : `${fr(s)} ${fr(1 - s)}`,
        cells: Array.from({ length: n }, (_, i) => ({ col: '1', row: `${i + 1}` })),
        axis: s === null ? null : 'y',
        dividerAt: s ?? 0.5
      }
    }
    case 'grid': {
      const c = n <= 2 ? n : n <= 4 ? 2 : 3
      const r = Math.ceil(n / c)
      return {
        ...base,
        cols: equal(c),
        rows: equal(r),
        cells: Array.from({ length: n }, (_, i) => {
          const lastAlone = i === n - 1 && n % c !== 0 // a short last row: stretch its last cell
          return {
            col: lastAlone ? `${(i % c) + 1} / ${c + 1}` : `${(i % c) + 1}`,
            row: `${Math.floor(i / c) + 1}`
          }
        })
      }
    }
    case 'main-left':
    case 'main-right': {
      const s = split ?? 0.6
      const left = resolveLayout(layout, n) === 'main-left'
      const mainCol = left ? '1' : '2'
      const sideCol = left ? '2' : '1'
      return {
        ...base,
        cols: left ? `${fr(s)} ${fr(1 - s)}` : `${fr(1 - s)} ${fr(s)}`,
        rows: equal(n - 1),
        cells: Array.from({ length: n }, (_, i) =>
          i === 0 ? { col: mainCol, row: `1 / ${n}` } : { col: sideCol, row: `${i}` }
        ),
        axis: 'x',
        dividerAt: left ? s : 1 - s,
        fromEnd: !left
      }
    }
    default: {
      // main-top
      const s = split ?? 0.6
      return {
        ...base,
        cols: equal(n - 1),
        rows: `${fr(s)} ${fr(1 - s)}`,
        cells: Array.from({ length: n }, (_, i) =>
          i === 0 ? { col: `1 / ${n}`, row: '1' } : { col: `${i}`, row: '2' }
        ),
        axis: 'y',
        dividerAt: s
      }
    }
  }
}
