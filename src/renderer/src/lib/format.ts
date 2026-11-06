import type { NetworkUnit } from '@shared/settings'

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']
const BIT_UNITS = ['b', 'Kb', 'Mb', 'Gb', 'Tb']

function scale(value: number, units: string[]): string {
  let v = value
  let i = 0
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  const digits = v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2
  return `${v.toFixed(digits)} ${units[i]}`
}

export const formatPercent = (v: number): string => `${Math.round(v)}%`

export function formatBytes(bytes: number): string {
  return scale(bytes, BYTE_UNITS)
}

/** Throughput, e.g. "4.2 MB/s" or, in bits, "33.6 Mb/s". */
export function formatRate(bytesPerSec: number | null, unit: NetworkUnit = 'bytes'): string {
  if (bytesPerSec === null) return 'n/a'
  return unit === 'bits'
    ? `${scale(bytesPerSec * 8, BIT_UNITS)}/s`
    : `${scale(bytesPerSec, BYTE_UNITS)}/s`
}
