import { useMemo, useState } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import { WIDGET_DEFS, WIDGET_KINDS } from '@shared/data'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSettings } from '@/store/settings'
import { useResourceFeed, useResources } from '@/store/resources'
import { METRICS, type MetricId } from './metrics'
import { Sparkline } from './sparkline'

const ORDER: Array<'cpu' | 'ram' | 'disk' | 'net'> = ['cpu', 'ram', 'disk', 'net']
const SHORT: Record<MetricId, string> = {
  cpu: 'CPU',
  ram: 'RAM',
  'cpu-ram': 'CPU',
  disk: 'Disk',
  net: 'Net'
}

function MetricRow({ id }: { id: MetricId }): React.JSX.Element {
  const def = METRICS[id]
  const samples = useResources((s) => s.samples)
  const unit = useSettings((s) => s.settings.resources.networkUnit)
  const series = useMemo(
    () => def.series.map((s) => ({ data: samples.map(s.pick), tone: s.tone })),
    [samples, def]
  )
  const latest = samples[samples.length - 1]
  const primary = def.series[0]
  const compact = latest ? primary.format(primary.pick(latest), unit) : 'n/a'
  const kind = id === 'cpu-ram' ? 'cpu-ram' : id

  return (
    <div className="group relative flex h-8 items-center gap-2 px-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-muted-foreground w-8 shrink-0 text-xs">{SHORT[id]}</span>
            <span className="w-[4.5rem] shrink-0 text-right font-mono text-xs tabular-nums">
              {compact}
            </span>
            <div className="h-4 min-w-0 flex-1">
              <Sparkline series={series} fixedMax={def.fixedMax} minMax={def.minMax} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          {def.headline(latest, unit)}
          {def.detail ? `, ${def.detail(latest, unit)}` : ''}
        </TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Pop out ${def.label}`}
        className="bg-card absolute right-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        onClick={() => window.api.widgets.open(kind)}
      >
        <ArrowSquareOut />
      </Button>
    </div>
  )
}

/** Docked resources block in the sidebar. Each row and the whole block can pop out. */
export function ResourcesSummary(): React.JSX.Element | null {
  const show = useSettings((s) => s.settings.resources.showInSidebar)
  const rows = ORDER.filter((id) => show[id])
  const [open, setOpen] = useState(false)
  useResourceFeed(rows.length > 0)

  if (rows.length === 0) return null

  return (
    <section aria-label="Resources" className="border-t pb-1">
      <div className="flex items-center justify-between pr-2 pl-4">
        <h2 className="text-muted-foreground py-2 text-xs font-medium">Resources</h2>
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label="Pop out resources">
                  <ArrowSquareOut />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Pop out as a window</TooltipContent>
          </Tooltip>
          <PopoverContent align="start" side="top" className="w-52 p-1">
            {WIDGET_KINDS.map((kind) => (
              <button
                key={kind}
                className="hover:bg-accent focus-visible:ring-ring/60 flex h-8 w-full items-center justify-between rounded-md px-2 text-left text-[13px] outline-none focus-visible:ring-2"
                onClick={() => {
                  window.api.widgets.open(kind)
                  setOpen(false)
                }}
              >
                {WIDGET_DEFS[kind].label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      <div className="px-1">
        {rows.map((id) => (
          <MetricRow key={id} id={id} />
        ))}
      </div>
    </section>
  )
}
