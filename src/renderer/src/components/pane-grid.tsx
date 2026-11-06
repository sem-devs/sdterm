import { useMemo } from 'react'
import { Plus, TerminalWindow } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PaneHeader } from '@/components/pane-header'
import { ParkedWorkspace } from '@/components/parked-workspace'
import { TerminalPane } from '@/components/terminal-pane'
import { cn } from '@/lib/utils'
import { selectActive, useWorkspaces, workspacesOf, type Workspace } from '@/store/workspace'

const isMac = window.api.platform === 'darwin'
const NEW_TERMINAL_HINT = isMac ? '⌘T' : 'Ctrl+Shift+T'

function gridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count <= 4) return 'grid-cols-2'
  return 'grid-cols-3'
}

function EmptyState({
  title,
  body,
  action,
  onAction
}: {
  title: string
  body: string
  action: string
  onAction: () => void
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-4 px-16">
      <TerminalWindow className="text-muted-foreground size-8" />
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground max-w-[44ch] text-sm">{body}</p>
      </div>
      <Button onClick={onAction}>{action}</Button>
    </div>
  )
}

function PaneFrame({
  workspace,
  index,
  visible
}: {
  workspace: Workspace
  index: number
  visible: boolean
}): React.JSX.Element {
  const pane = workspace.panes[index]
  const focused = workspace.activePaneId === pane.id
  const focusPane = useWorkspaces((s) => s.focusPane)

  return (
    <section
      className={cn(
        'bg-background flex min-h-0 min-w-0 flex-col',
        workspace.panes.length === 3 && index === 0 && 'row-span-2'
      )}
      onMouseDown={() => focusPane(pane.id)}
    >
      <PaneHeader pane={pane} index={index} focused={focused} folder={workspace.folder} />
      <div className="min-h-0 flex-1">
        <TerminalPane
          paneId={pane.id}
          focused={focused}
          visible={visible}
          cwd={workspace.folder || undefined}
        />
      </div>
    </section>
  )
}

export function PaneGrid({ hidden }: { hidden?: boolean }): React.JSX.Element {
  const workspaces = useWorkspaces((s) => s.workspaces)
  const activeId = useWorkspaces((s) => selectActive(s)?.id)
  const addWorkspace = useWorkspaces((s) => s.addWorkspace)
  const addPane = useWorkspaces((s) => s.addPane)
  const mine = useMemo(() => workspacesOf(workspaces), [workspaces])

  // Every workspace of this window stays mounted, so its shells keep running while another
  // one is in front. Parked workspaces have no terminals at all.
  return (
    <div className={cn('min-h-0 flex-1', hidden && 'hidden')}>
      {mine.length === 0 && (
        <EmptyState
          title="No workspaces in this window"
          body="Create one here, or move a workspace over from another window."
          action="New workspace"
          onAction={addWorkspace}
        />
      )}
      {mine.map((ws) => {
        const isActive = ws.id === activeId
        return (
          <div key={ws.id} className={cn('h-full', !isActive && 'hidden')}>
            {ws.parked ? (
              isActive && <ParkedWorkspace ws={ws} />
            ) : ws.panes.length === 0 ? (
              <EmptyState
                title="No terminals in this workspace"
                body="Open a shell to get started. Each terminal keeps running while you switch workspaces."
                action="New terminal"
                onAction={addPane}
              />
            ) : (
              <div
                className={cn(
                  'bg-border grid h-full auto-rows-fr gap-px overflow-hidden',
                  gridClass(ws.panes.length)
                )}
              >
                {ws.panes.map((p, i) => (
                  <PaneFrame key={p.id} workspace={ws} index={i} visible={isActive && !hidden} />
                ))}
              </div>
            )}
          </div>
        )
      })}
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
