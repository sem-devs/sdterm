import { useEffect, useRef, useState } from 'react'
import { Gear, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BrandLogo } from '@/components/brand-logo'
import { ResourcesSummary } from '@/components/resources/resources-summary'
import { cn } from '@/lib/utils'
import { paneColorVar } from '@/lib/pane-color'
import { useUi } from '@/store/ui'
import { paneLabel, useWorkspaces, type Workspace } from '@/store/workspace'

const isMac = window.api.platform === 'darwin'

function WorkspaceName({
  ws,
  editing,
  done
}: {
  ws: Workspace
  editing: boolean
  done: () => void
}): React.JSX.Element {
  const rename = useWorkspaces((s) => s.renameWorkspace)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) ref.current?.select()
  }, [editing])

  if (!editing) return <span className="truncate">{ws.name}</span>
  return (
    <input
      ref={ref}
      autoFocus
      defaultValue={ws.name}
      maxLength={60}
      aria-label="Workspace name"
      className="bg-background border-input focus-visible:ring-ring/60 -mx-1 h-6 min-w-0 flex-1 rounded-sm border px-1 text-[13px] outline-none focus-visible:ring-2"
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        rename(ws.id, e.target.value.trim() || ws.name)
        done()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.currentTarget.value = ws.name
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function WorkspaceItem({ ws, active }: { ws: Workspace; active: boolean }): React.JSX.Element {
  const setActive = useWorkspaces((s) => s.setActiveWorkspace)
  const focusPane = useWorkspaces((s) => s.focusPane)
  const setView = useUi((s) => s.setView)
  const [editing, setEditing] = useState(false)

  return (
    <div>
      <button
        onClick={() => {
          setActive(ws.id)
          setView('terminals')
        }}
        onDoubleClick={() => setEditing(true)}
        aria-current={active ? 'page' : undefined}
        title="Double-click to rename"
        className={cn(
          'focus-visible:ring-ring/60 flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[13px] transition-colors outline-none focus-visible:ring-2',
          active
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
        )}
      >
        <WorkspaceName ws={ws} editing={editing} done={() => setEditing(false)} />
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {ws.panes.length}
        </span>
      </button>

      {/* Which terminal is which, and what it was for: name, colour and note at a glance. */}
      {active && ws.panes.length > 0 && (
        <ul className="mt-0.5 mb-1.5 ml-3 flex flex-col gap-px border-l pl-2">
          {ws.panes.map((p, i) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  focusPane(p.id)
                  setView('terminals')
                }}
                className={cn(
                  'hover:bg-accent/60 focus-visible:ring-ring/60 flex w-full items-start gap-2 rounded-md px-2 py-1 text-left outline-none focus-visible:ring-2',
                  ws.activePaneId === p.id ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-[3px] size-2.5 shrink-0 rounded-[3px]',
                    !p.color && 'border-muted-foreground/60 border'
                  )}
                  style={p.color ? { backgroundColor: paneColorVar(p.color) } : undefined}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-xs leading-4 font-medium">{paneLabel(p, i)}</span>
                  {p.note && (
                    <span className="text-muted-foreground truncate text-[11px] leading-4">
                      {p.note.split('\n')[0]}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Sidebar(): React.JSX.Element {
  const workspaces = useWorkspaces((s) => s.workspaces)
  const activeId = useWorkspaces((s) => s.activeWorkspaceId)
  const addWorkspace = useWorkspaces((s) => s.addWorkspace)
  const view = useUi((s) => s.view)
  const setView = useUi((s) => s.setView)

  return (
    <aside className="bg-card flex w-60 shrink-0 flex-col border-r">
      {/* Leaves room for the macOS traffic lights; draggable like the rest of the title bar. */}
      <div className={cn('app-drag flex h-10 shrink-0 items-center', isMac ? 'pl-20' : 'pl-4')}>
        <span className="font-display text-[13px] font-semibold tracking-tight">SEM Term</span>
      </div>

      <div className="flex items-center justify-between pr-2 pl-4">
        <h2 className="text-muted-foreground text-xs font-medium">Workspaces</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="New workspace"
              onClick={addWorkspace}
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New workspace</TooltipContent>
        </Tooltip>
      </div>

      <nav
        aria-label="Workspaces"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        {workspaces.map((ws) => (
          <WorkspaceItem key={ws.id} ws={ws} active={ws.id === activeId} />
        ))}
      </nav>

      <ResourcesSummary />

      {/* The brand is always on screen, whichever view is open. */}
      <footer className="flex h-12 shrink-0 items-center justify-between border-t pr-2 pl-4">
        <a
          href="https://sem-devs.com"
          target="_blank"
          rel="noreferrer"
          aria-label="SEM Devs website"
          className="focus-visible:ring-ring/60 rounded-sm outline-none focus-visible:ring-2"
        >
          <BrandLogo className="text-foreground h-[18px] w-auto" />
        </a>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Settings"
              aria-pressed={view === 'settings'}
              className={cn(view === 'settings' && 'bg-accent text-foreground')}
              onClick={() => setView(view === 'settings' ? 'terminals' : 'settings')}
            >
              <Gear />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings ({isMac ? '⌘,' : 'Ctrl+Shift+,'})</TooltipContent>
        </Tooltip>
      </footer>
    </aside>
  )
}
