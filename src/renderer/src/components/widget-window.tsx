import { useState } from 'react'
import { PushPin, X } from '@phosphor-icons/react'
import { WIDGET_DEFS, type WidgetKind } from '@shared/data'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BrandMark } from '@/components/brand-logo'
import { MetricPanel } from '@/components/resources/metric-panel'
import { WIDGET_METRICS } from '@/components/resources/metrics'
import { useResourceFeed } from '@/store/resources'
import { useSettings } from '@/store/settings'

/** Content of a popped-out resources window. Frameless, so it draws its own title bar. */
export function WidgetWindow({ kind }: { kind: WidgetKind }): React.JSX.Element {
  useResourceFeed()
  const [pinned, setPinned] = useState(
    () => useSettings.getState().settings.resources.popoutAlwaysOnTop
  )
  const metrics = WIDGET_METRICS[kind]

  const togglePin = (): void => {
    window.api.widgets.setPinned(!pinned)
    setPinned(!pinned)
  }

  return (
    <div className="bg-background flex h-full flex-col border">
      <header className="app-drag bg-card flex h-9 shrink-0 items-center justify-between border-b pr-1 pl-3">
        <div className="flex items-center gap-2">
          <BrandMark className="size-3.5" />
          <h1 className="font-display text-[13px] font-semibold tracking-tight">
            {WIDGET_DEFS[kind].label}
          </h1>
        </div>
        <div className="app-no-drag flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={pinned ? 'Unpin from top' : 'Keep on top'}
                aria-pressed={pinned}
                className={pinned ? 'text-primary' : undefined}
                onClick={togglePin}
              >
                <PushPin weight={pinned ? 'fill' : 'regular'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{pinned ? 'Unpin from top' : 'Keep on top'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => window.api.widgets.close()}
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
        {metrics.map((id) => (
          <MetricPanel key={id} id={id} className={metrics.length === 1 ? 'flex-1' : undefined} />
        ))}
      </div>
    </div>
  )
}
