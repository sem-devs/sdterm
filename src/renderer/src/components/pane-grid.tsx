import { useMemo, useRef, useState } from 'react'
import { Plus, TerminalWindow } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PaneHeader } from '@/components/pane-header'
import { ParkedWorkspace } from '@/components/parked-workspace'
import { TerminalPane } from '@/components/terminal-pane'
import { PANE_MIME, computeLayout, type Cell, type LayoutResult } from '@/lib/layout'
import { cn } from '@/lib/utils'
import { selectActive, useWorkspaces, workspacesOf, type Workspace } from '@/store/workspace'

const isMac = window.api.platform === 'darwin'
const NEW_TERMINAL_HINT = isMac ? '⌘T' : 'Ctrl+Shift+T'

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
  visible,
  cell
}: {
  workspace: Workspace
  index: number
  visible: boolean
  cell: { col: string; row: string }
}): React.JSX.Element {
  const pane = workspace.panes[index]
  const focused = workspace.activePaneId === pane.id
  const focusPane = useWorkspaces((s) => s.focusPane)
  const swapPanes = useWorkspaces((s) => s.swapPanes)
  const [dropping, setDropping] = useState(false)

  return (
    <section
      className="bg-background relative flex min-h-0 min-w-0 flex-col"
      style={{ gridColumn: cell.col, gridRow: cell.row }}
      onMouseDown={() => focusPane(pane.id)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(PANE_MIME)) return
        e.preventDefault() // this terminal accepts a dragged terminal
        setDropping(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false)
      }}
      onDrop={(e) => {
        setDropping(false)
        const dragged = e.dataTransfer.getData(PANE_MIME)
        if (dragged && dragged !== pane.id) swapPanes(dragged, pane.id)
      }}
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
      {dropping && (
        <div
          aria-hidden
          className="ring-primary bg-primary/10 pointer-events-none absolute inset-0 z-10 ring-2 ring-inset"
        />
      )}
    </section>
  )
}

/** An open spot in the quarters layout: one click starts a terminal there. */
function EmptySlot({ cell }: { cell: Cell }): React.JSX.Element {
  const addPane = useWorkspaces((s) => s.addPane)
  return (
    <section
      className="bg-background flex min-h-0 min-w-0 p-3"
      style={{ gridColumn: cell.col, gridRow: cell.row }}
    >
      <button
        onClick={addPane}
        className="text-muted-foreground hover:text-foreground hover:border-primary/60 hover:bg-accent/40 focus-visible:ring-ring/60 border-border flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm transition-colors outline-none focus-visible:ring-2"
      >
        <Plus className="size-5" />
        New terminal
        <span className="font-mono text-xs opacity-70">{NEW_TERMINAL_HINT}</span>
      </button>
    </section>
  )
}

/** The draggable line between the two regions of a layout. */
function Divider({
  workspace,
  layout,
  containerRef
}: {
  workspace: Workspace
  layout: LayoutResult
  containerRef: React.RefObject<HTMLDivElement | null>
}): React.JSX.Element | null {
  const setSplit = useWorkspaces((s) => s.setSplit)
  if (!layout.axis) return null
  const horizontal = layout.axis === 'x' // columns are separated by a vertical line

  const start = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    let frame = 0
    const move = (ev: PointerEvent): void => {
      const box = containerRef.current?.getBoundingClientRect()
      if (!box) return
      const p = horizontal
        ? (ev.clientX - box.left) / box.width
        : (ev.clientY - box.top) / box.height
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setSplit(workspace.id, layout.fromEnd ? 1 - p : p))
    }
    const end = (): void => {
      el.releasePointerCapture(e.pointerId)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  return (
    <div
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label="Resize terminals"
      onPointerDown={start}
      onDoubleClick={() => setSplit(workspace.id, layout.fromEnd ? 0.4 : 0.5)}
      className={cn(
        'group/divider absolute z-20 flex items-center justify-center',
        horizontal ? 'top-0 bottom-0 w-2 cursor-col-resize' : 'right-0 left-0 h-2 cursor-row-resize'
      )}
      style={
        horizontal
          ? { left: `calc(${layout.dividerAt * 100}% - 4px)` }
          : { top: `calc(${layout.dividerAt * 100}% - 4px)` }
      }
    >
      <span
        className={cn(
          'bg-primary/0 group-hover/divider:bg-primary/60 transition-colors',
          horizontal ? 'h-full w-0.5' : 'h-0.5 w-full'
        )}
      />
    </div>
  )
}

function Workspaced({ ws, visible }: { ws: Workspace; visible: boolean }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const layout = useMemo(
    () => computeLayout(ws.layout, ws.panes.length, ws.split),
    [ws.layout, ws.panes.length, ws.split]
  )
  // Terminals stay in a fixed order in the page (by id) and are placed by their grid cell, so
  // swapping two of them moves no DOM and never disturbs a running terminal.
  const stable = useMemo(
    () => ws.panes.map((p, slot) => ({ p, slot })).sort((x, y) => (x.p.id < y.p.id ? -1 : 1)),
    [ws.panes]
  )

  return (
    <div ref={containerRef} className="relative h-full">
      <div
        className="bg-border grid h-full gap-px overflow-hidden"
        style={{ gridTemplateColumns: layout.cols, gridTemplateRows: layout.rows }}
      >
        {stable.map(({ p, slot }) => (
          <PaneFrame
            key={p.id}
            workspace={ws}
            index={slot}
            visible={visible}
            cell={layout.cells[slot]}
          />
        ))}
        {layout.empty.map((cell, i) => (
          <EmptySlot key={`empty-${i}`} cell={cell} />
        ))}
      </div>
      <Divider workspace={ws} layout={layout} containerRef={containerRef} />
    </div>
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
              <Workspaced ws={ws} visible={isActive && !hidden} />
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
