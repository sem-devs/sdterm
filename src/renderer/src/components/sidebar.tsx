import { Desktop, Moon, Plus, Sun } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useTheme, type ThemeMode } from '@/hooks/use-theme'
import { useWorkspaces } from '@/store/workspace'

const isMac = window.api.platform === 'darwin'

const THEMES: Array<{ mode: ThemeMode; label: string; Icon: typeof Sun }> = [
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'dark', label: 'Dark', Icon: Moon },
  { mode: 'system', label: 'System', Icon: Desktop }
]

export function Sidebar(): React.JSX.Element {
  const workspaces = useWorkspaces((s) => s.workspaces)
  const activeId = useWorkspaces((s) => s.activeWorkspaceId)
  const setActive = useWorkspaces((s) => s.setActiveWorkspace)
  const addWorkspace = useWorkspaces((s) => s.addWorkspace)
  const { mode, setMode } = useTheme()

  return (
    <aside className="bg-card flex w-56 shrink-0 flex-col border-r">
      {/* Leaves room for the macOS traffic lights; draggable like the rest of the title bar. */}
      <div className={cn('app-drag flex h-10 shrink-0 items-center', isMac ? 'pl-20' : 'pl-4')}>
        <span className="text-[13px] font-semibold tracking-tight">SEM Term</span>
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

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => setActive(ws.id)}
            aria-current={ws.id === activeId ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/60 flex h-8 items-center justify-between rounded-md px-2 text-left text-[13px] transition-colors outline-none focus-visible:ring-2',
              ws.id === activeId
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
          >
            <span className="truncate">{ws.name}</span>
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {ws.panes.length}
            </span>
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-0.5 border-t p-2" role="group" aria-label="Theme">
        {THEMES.map(({ mode: m, label, Icon }) => (
          <Tooltip key={m}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${label} theme`}
                aria-pressed={mode === m}
                className={cn(mode === m && 'bg-accent text-foreground')}
                onClick={() => setMode(m)}
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </aside>
  )
}
