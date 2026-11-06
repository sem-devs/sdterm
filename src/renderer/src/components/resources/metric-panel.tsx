import { useMemo, useState } from 'react'
import { useSettings } from '@/store/settings'
import { useResources } from '@/store/resources'
import { cn } from '@/lib/utils'
import { METRICS, type MetricId } from './metrics'
import { Sparkline } from './sparkline'

/** Large chart with a hover readout. Used inside the pop-out windows. */
export function MetricPanel({
  id,
  className
}: {
  id: MetricId
  className?: string
}): React.JSX.Element {
  const def = METRICS[id]
  const samples = useResources((s) => s.samples)
  const unit = useSettings((s) => s.settings.resources.networkUnit)
  const [hover, setHover] = useState<number | null>(null)

  const series = useMemo(
    () => def.series.map((s) => ({ data: samples.map(s.pick), tone: s.tone })),
    [samples, def]
  )

  const latest = samples[samples.length - 1]
  const shown = hover !== null ? samples[hover] : latest
  const age = hover !== null && latest && shown ? Math.round((latest.t - shown.t) / 1000) : 0

  return (
    <section className={cn('flex min-h-[9.5rem] shrink-0 flex-col gap-2 p-3', className)}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-muted-foreground text-xs font-medium">{def.label}</h2>
        <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
          {hover === null ? 'live' : age === 0 ? 'now' : `${age}s ago`}
        </span>
      </header>

      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-2xl leading-none font-semibold tracking-tight tabular-nums">
          {def.headline(shown, unit)}
        </p>
        {def.detail && (
          <p className="text-muted-foreground truncate text-xs tabular-nums">
            {def.detail(shown, unit)}
          </p>
        )}
      </div>

      {/* The SVG is absolute: with a square viewBox it would otherwise size itself to its width. */}
      <div className="relative min-h-12 flex-1">
        <Sparkline
          className="absolute inset-0"
          series={series}
          fixedMax={def.fixedMax}
          minMax={def.minMax}
          onHover={setHover}
          hoverIndex={hover}
        />
      </div>

      {def.series.length > 1 && (
        <ul className="flex items-center gap-4 text-xs">
          {def.series.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'h-0.5 w-3.5 rounded-full',
                  s.tone === 'primary' ? 'bg-primary' : 'bg-muted-foreground/70'
                )}
              />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-mono tabular-nums">
                {shown ? s.format(s.pick(shown), unit) : 'n/a'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
