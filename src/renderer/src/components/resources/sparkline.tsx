import { useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { WINDOW } from '@/store/resources'

export interface SparkSeries {
  data: Array<number | null>
  tone: 'primary' | 'secondary'
}

interface Props {
  series: SparkSeries[]
  /** Fixed top of the scale. Without it the scale follows the data (never below minMax). */
  fixedMax?: number
  minMax?: number
  className?: string
  /** Hover reports the sample index under the pointer so the parent can show exact values. */
  onHover?: (index: number | null) => void
  hoverIndex?: number | null
}

const W = 100
const H = 100

const STROKE: Record<SparkSeries['tone'], string> = {
  primary: 'stroke-primary',
  secondary: 'stroke-muted-foreground/70'
}

// Samples are right-aligned: the newest is always at the right edge, so a young history
// fills in from the right instead of stretching to the full width.
const xAt = (i: number, len: number): number => ((i + (WINDOW - len)) / (WINDOW - 1)) * W

export function Sparkline({
  series,
  fixedMax,
  minMax = 1,
  className,
  onHover,
  hoverIndex
}: Props): React.JSX.Element {
  const gradId = useId()

  const { paths, area, max, len } = useMemo(() => {
    const length = Math.max(...series.map((s) => s.data.length), 0)
    const peak = Math.max(
      0,
      ...series.flatMap((s) => s.data.filter((v): v is number => v !== null))
    )
    const top = fixedMax ?? Math.max(minMax, peak * 1.15)
    const y = (v: number): number => H - (Math.min(v, top) / top) * H

    // A null (metric unavailable, or the very first sample) breaks the line instead of drawing 0.
    const toPath = (data: Array<number | null>): string => {
      let d = ''
      let pen = false
      data.forEach((v, i) => {
        if (v === null) {
          pen = false
          return
        }
        d += `${pen ? 'L' : 'M'}${xAt(i, length).toFixed(2)} ${y(v).toFixed(2)}`
        pen = true
      })
      return d
    }

    const first = series[0]?.data ?? []
    const valid = first
      .map((v, i) => (v === null ? null : i))
      .filter((i): i is number => i !== null)
    const areaPath =
      valid.length > 1
        ? `${toPath(first)}L${xAt(valid[valid.length - 1], length).toFixed(2)} ${H}L${xAt(valid[0], length).toFixed(2)} ${H}Z`
        : ''

    return { paths: series.map((s) => toPath(s.data)), area: areaPath, max: top, len: length }
  }, [series, fixedMax, minMax])

  const [local, setLocal] = useState<number | null>(null)
  const active = hoverIndex ?? local

  const handleMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (len === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round((x / W) * (WINDOW - 1)) - (WINDOW - len)
    const clamped = Math.min(len - 1, Math.max(0, idx))
    setLocal(clamped)
    onHover?.(clamped)
  }
  const handleLeave = (): void => {
    setLocal(null)
    onHover?.(null)
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn('block h-full w-full overflow-visible', className)}
      onPointerMove={onHover ? handleMove : undefined}
      onPointerLeave={onHover ? handleLeave : undefined}
      role="img"
      aria-label={`Chart, scale 0 to ${Math.round(max)}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Recessive baseline and midline; the data carries the visual weight. */}
      <line
        x1="0"
        y1={H}
        x2={W}
        y2={H}
        className="stroke-border"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="0"
        y1={H / 2}
        x2={W}
        y2={H / 2}
        className="stroke-border/50"
        strokeWidth="1"
        strokeDasharray="2 3"
        vectorEffect="non-scaling-stroke"
      />
      {area && <path d={area} fill={`url(#${gradId})`} />}
      {paths.map((d, i) =>
        d ? (
          <path
            key={i}
            d={d}
            fill="none"
            className={STROKE[series[i].tone]}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null
      )}
      {active !== null && len > 0 && (
        <line
          x1={xAt(active, len)}
          x2={xAt(active, len)}
          y1="0"
          y2={H}
          className="stroke-foreground/40"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  )
}
