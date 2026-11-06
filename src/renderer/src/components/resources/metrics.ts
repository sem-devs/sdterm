import type { ResourceSample, WidgetKind } from '@shared/data'
import type { NetworkUnit } from '@shared/settings'
import { formatBytes, formatPercent, formatRate } from '@/lib/format'

export type MetricId = 'cpu' | 'ram' | 'cpu-ram' | 'disk' | 'net'

export interface SeriesDef {
  label: string
  /** primary is drawn in the brand accent, secondary in a neutral, so no second hue is needed. */
  tone: 'primary' | 'secondary'
  pick: (s: ResourceSample) => number | null
  format: (v: number | null, unit: NetworkUnit) => string
}

export interface MetricDef {
  id: MetricId
  label: string
  series: SeriesDef[]
  /** Fixed scale (percent metrics). Rate metrics scale to the data, but never below minMax. */
  fixedMax?: number
  minMax?: number
  headline: (s: ResourceSample | undefined, unit: NetworkUnit) => string
  detail?: (s: ResourceSample | undefined, unit: NetworkUnit) => string
}

const pct = (v: number | null): string => (v === null ? 'n/a' : formatPercent(v))
const ramPct = (s: ResourceSample): number => (s.memTotal > 0 ? (s.memUsed / s.memTotal) * 100 : 0)

const cpuSeries: SeriesDef = { label: 'CPU', tone: 'primary', pick: (s) => s.cpu, format: pct }
const ramSeries: SeriesDef = { label: 'RAM', tone: 'secondary', pick: ramPct, format: pct }

export const METRICS: Record<MetricId, MetricDef> = {
  cpu: {
    id: 'cpu',
    label: 'CPU',
    series: [cpuSeries],
    fixedMax: 100,
    headline: (s) => (s ? formatPercent(s.cpu) : 'n/a'),
    detail: (s) => (s ? `${s.cores} cores` : '')
  },
  ram: {
    id: 'ram',
    label: 'RAM',
    series: [{ ...ramSeries, tone: 'primary' }],
    fixedMax: 100,
    headline: (s) => (s ? formatPercent(ramPct(s)) : 'n/a'),
    detail: (s) => (s ? `${formatBytes(s.memUsed)} of ${formatBytes(s.memTotal)}` : '')
  },
  'cpu-ram': {
    id: 'cpu-ram',
    label: 'CPU and RAM',
    series: [cpuSeries, ramSeries],
    fixedMax: 100,
    headline: (s) => (s ? `${formatPercent(s.cpu)} / ${formatPercent(ramPct(s))}` : 'n/a'),
    detail: (s) =>
      s ? `${s.cores} cores, ${formatBytes(s.memUsed)} of ${formatBytes(s.memTotal)}` : ''
  },
  disk: {
    id: 'disk',
    label: 'Disk I/O',
    series: [
      {
        label: 'Read',
        tone: 'primary',
        pick: (s) => s.diskRead,
        format: (v, u) => formatRate(v, u)
      },
      {
        label: 'Write',
        tone: 'secondary',
        pick: (s) => s.diskWrite,
        format: (v, u) => formatRate(v, u)
      }
    ],
    minMax: 1_000_000,
    headline: (s, u) => (s ? `${formatRate(s.diskRead, u)} read` : 'n/a'),
    detail: (s, u) => (s ? `${formatRate(s.diskWrite, u)} write` : '')
  },
  net: {
    id: 'net',
    label: 'Network I/O',
    series: [
      {
        label: 'Down',
        tone: 'primary',
        pick: (s) => s.netDown,
        format: (v, u) => formatRate(v, u)
      },
      { label: 'Up', tone: 'secondary', pick: (s) => s.netUp, format: (v, u) => formatRate(v, u) }
    ],
    minMax: 100_000,
    headline: (s, u) => (s ? `${formatRate(s.netDown, u)} down` : 'n/a'),
    detail: (s, u) => (s ? `${formatRate(s.netUp, u)} up` : '')
  }
}

/** Which charts each pop-out window shows, top to bottom. */
export const WIDGET_METRICS: Record<WidgetKind, MetricId[]> = {
  summary: ['cpu', 'ram', 'disk', 'net'],
  cpu: ['cpu'],
  ram: ['ram'],
  'cpu-ram': ['cpu-ram'],
  disk: ['disk'],
  net: ['net']
}
