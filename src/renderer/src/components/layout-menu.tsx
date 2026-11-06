import { useState } from 'react'
import { SquaresFour } from '@phosphor-icons/react'
import { LAYOUTS, type LayoutId } from '@shared/data'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LAYOUT_LABELS, computeLayout } from '@/lib/layout'
import { cn } from '@/lib/utils'
import { selectActive, useWorkspaces } from '@/store/workspace'

/** A miniature of what the layout looks like with four terminals, like window-snapping tools. */
function Thumb({ layout }: { layout: LayoutId }): React.JSX.Element {
  const l = computeLayout(layout, 4, null)
  return (
    <div
      aria-hidden
      className="grid h-8 w-12 gap-px"
      style={{ gridTemplateColumns: l.cols, gridTemplateRows: l.rows }}
    >
      {l.cells.map((c, i) => (
        <span
          key={i}
          className="bg-muted-foreground/40 rounded-[2px]"
          style={{ gridColumn: c.col, gridRow: c.row }}
        />
      ))}
    </div>
  )
}

/** Picks how the active workspace arranges its terminals. */
export function LayoutMenu(): React.JSX.Element | null {
  const ws = useWorkspaces((s) => selectActive(s))
  const setLayout = useWorkspaces((s) => s.setLayout)
  const [open, setOpen] = useState(false)
  if (!ws || ws.parked) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Arrange terminals">
              <SquaresFour />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Arrange terminals</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="text-muted-foreground px-1 pb-2 text-xs">
          Pick a layout. Drag a terminal&apos;s title bar onto another to swap them, and drag the
          divider to resize.
        </p>
        <div className="grid grid-cols-2 gap-1">
          {LAYOUTS.map((id) => (
            <button
              key={id}
              onClick={() => {
                setLayout(ws.id, id)
                setOpen(false)
              }}
              aria-pressed={ws.layout === id}
              className={cn(
                'hover:bg-accent focus-visible:ring-ring/60 flex items-center gap-2 rounded-md border border-transparent p-2 text-left text-xs outline-none focus-visible:ring-2',
                ws.layout === id && 'border-primary bg-accent'
              )}
            >
              <Thumb layout={id} />
              {LAYOUT_LABELS[id]}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
