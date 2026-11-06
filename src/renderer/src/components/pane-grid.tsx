import { TerminalWindow, Plus, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TerminalPane } from '@/components/terminal-pane'
import { cn } from '@/lib/utils'
import { useWorkspaces, type Workspace } from '@/store/workspace'

const isMac = window.api.platform === 'darwin'
const NEW_TERMINAL_HINT = isMac ? '⌘T' : 'Ctrl+Shift+T'
const CLOSE_HINT = isMac ? '⌘W' : 'Ctrl+Shift+W'

function gridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count <= 4) return 'grid-cols-2'
  return 'grid-cols-3'
}

function EmptyWorkspace(): React.JSX.Element {
  const addPane = useWorkspaces((s) => s.addPane)
  return (
    <div className="flex h-full flex-col items-start justify-center gap-4 px-16">
      <TerminalWindow className="text-muted-foreground size-8" />
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight">No terminals in this workspace</h2>
        <p className="text-muted-foreground max-w-[44ch] text-sm">
          Open a shell to get started. Each terminal keeps running while you switch workspaces.
        </p>
      </div>
      <Button onClick={addPane}>New terminal</Button>
    </div>
  )
}

function PaneFrame({
  workspace,
  index
}: {
  workspace: Workspace
  index: number
}): React.JSX.Element {
  const pane = workspace.panes[index]
  const focused = workspace.activePaneId === pane.id
  const { focusPane, closePane } = useWorkspaces.getState()

  return (
    <section
      className={cn(
        'bg-background flex min-h-0 min-w-0 flex-col',
        workspace.panes.length === 3 && index === 0 && 'row-span-2'
      )}
      onMouseDown={() => focusPane(pane.id)}
    >
      <header
        className={cn(
          'flex h-7 shrink-0 items-center justify-between border-t-2 pr-1 pl-3 text-xs',
          focused ? 'border-primary text-foreground' : 'text-muted-foreground border-transparent'
        )}
      >
        <span className="truncate">{pane.title}</span>
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
      <div className="min-h-0 flex-1">
        <TerminalPane paneId={pane.id} focused={focused} />
      </div>
    </section>
  )
}

export function PaneGrid(): React.JSX.Element {
  const workspaces = useWorkspaces((s) => s.workspaces)
  const activeId = useWorkspaces((s) => s.activeWorkspaceId)

  // Every workspace stays mounted so its shells keep running while hidden.
  return (
    <div className="min-h-0 flex-1">
      {workspaces.map((ws) => (
        <div key={ws.id} className={cn('h-full', ws.id !== activeId && 'hidden')}>
          {ws.panes.length === 0 ? (
            <EmptyWorkspace />
          ) : (
            <div
              className={cn(
                'bg-border grid h-full auto-rows-fr gap-px overflow-hidden',
                gridClass(ws.panes.length)
              )}
            >
              {ws.panes.map((p, i) => (
                <PaneFrame key={p.id} workspace={ws} index={i} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function NewTerminalButton(): React.JSX.Element {
  const addPane = useWorkspaces((s) => s.addPane)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="New terminal" onClick={addPane}>
          <Plus />
        </Button>
      </TooltipTrigger>
      <TooltipContent>New terminal ({NEW_TERMINAL_HINT})</TooltipContent>
    </Tooltip>
  )
}
