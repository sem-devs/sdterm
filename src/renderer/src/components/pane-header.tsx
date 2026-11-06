import { Prohibit, X } from '@phosphor-icons/react'
import { PANE_COLORS, type PaneColor } from '@shared/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { paneColorVar } from '@/lib/pane-color'
import { paneLabel, useWorkspaces, type Pane } from '@/store/workspace'

const isMac = window.api.platform === 'darwin'
const CLOSE_HINT = isMac ? '⌘W' : 'Ctrl+Shift+W'

const COLOR_NAMES: Record<PaneColor, string> = {
  cyan: 'Cyan',
  blue: 'Blue',
  green: 'Green',
  amber: 'Amber',
  orange: 'Orange',
  rose: 'Rose',
  violet: 'Violet',
  graphite: 'Graphite'
}

function Editor({ pane }: { pane: Pane }): React.JSX.Element {
  const updatePane = useWorkspaces((s) => s.updatePane)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`name-${pane.id}`}>Name</Label>
        <Input
          id={`name-${pane.id}`}
          autoFocus
          value={pane.name}
          maxLength={80}
          placeholder={pane.autoTitle || 'What is this terminal for?'}
          onChange={(e) => updatePane(pane.id, { name: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`note-${pane.id}`}>Note</Label>
        <Textarea
          id={`note-${pane.id}`}
          value={pane.note}
          maxLength={1000}
          rows={4}
          placeholder="What are you working on? Where did you leave off?"
          className="resize-none"
          onChange={(e) => updatePane(pane.id, { note: e.target.value })}
        />
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm leading-none font-medium">Color</legend>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-label="No color"
            aria-pressed={pane.color === null}
            onClick={() => updatePane(pane.id, { color: null })}
            className={cn(
              'text-muted-foreground flex size-6 items-center justify-center rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              pane.color === null && 'border-foreground text-foreground'
            )}
          >
            <Prohibit className="size-3.5" />
          </button>
          {PANE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={COLOR_NAMES[c]}
              aria-pressed={pane.color === c}
              title={COLOR_NAMES[c]}
              onClick={() => updatePane(pane.id, { color: c })}
              style={{ backgroundColor: `var(--pane-${c})` }}
              className={cn(
                'size-6 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                pane.color === c && 'ring-foreground ring-offset-popover ring-2 ring-offset-2'
              )}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}

/** Title bar of a terminal: colour, name, note preview, and the editor that changes them. */
export function PaneHeader({
  pane,
  index,
  focused
}: {
  pane: Pane
  index: number
  focused: boolean
}): React.JSX.Element {
  const closePane = useWorkspaces((s) => s.closePane)
  const label = paneLabel(pane, index)
  const firstLine = pane.note.split('\n')[0]

  return (
    <header
      className={cn(
        'group relative flex h-8 shrink-0 items-center pr-1 text-xs',
        focused ? 'text-foreground' : 'text-muted-foreground'
      )}
      style={{
        ['--pane' as string]: paneColorVar(pane.color),
        // A faint tint of the pane colour makes terminals easy to tell apart across a grid.
        backgroundColor: pane.color ? 'color-mix(in oklab, var(--pane) 7%, transparent)' : undefined
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 transition-opacity"
        style={{
          backgroundColor: 'var(--pane)',
          opacity: focused ? 1 : pane.color ? 0.4 : 0
        }}
      />

      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                data-pane-edit
                className="focus-visible:ring-ring/60 flex h-full min-w-0 flex-1 items-center gap-2 pl-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
              >
                <span className={cn('shrink-0 font-medium', !pane.name && 'italic')}>{label}</span>
                {firstLine ? (
                  <span className="text-muted-foreground truncate">{firstLine}</span>
                ) : (
                  <span className="text-muted-foreground/70 truncate opacity-0 transition-opacity group-hover:opacity-100">
                    Add a note
                  </span>
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-pre-wrap">
            {pane.note || 'Edit name, note and color'}
          </TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-80">
          <Editor pane={pane} />
        </PopoverContent>
      </Popover>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Close terminal"
            onClick={(e) => {
              e.stopPropagation()
              closePane(pane.id)
            }}
          >
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Close terminal ({CLOSE_HINT})</TooltipContent>
      </Tooltip>
    </header>
  )
}
