import { useEffect } from 'react'
import { NewTerminalButton, PaneGrid } from '@/components/pane-grid'
import { Sidebar } from '@/components/sidebar'
import { cn } from '@/lib/utils'
import { useWorkspaces } from '@/store/workspace'

const isMac = window.api.platform === 'darwin'

function App(): React.JSX.Element {
  const title = useWorkspaces(
    (s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name ?? ''
  )

  // Native menu items (and their shortcuts) arrive here as commands.
  useEffect(
    () =>
      window.api.onCommand((cmd) => {
        const s = useWorkspaces.getState()
        if (cmd === 'new-pane') s.addPane()
        if (cmd === 'new-workspace') s.addWorkspace()
        if (cmd === 'close-pane') {
          const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
          if (ws?.activePaneId) s.closePane(ws.activePaneId)
        }
      }),
    []
  )

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        {/* On Windows the native window controls overlay the right edge of this bar. */}
        <div
          className={cn(
            'app-drag flex h-10 shrink-0 items-center justify-between border-b pl-4',
            isMac ? 'pr-2' : 'pr-36'
          )}
        >
          <h1 className="text-[13px] font-medium">{title}</h1>
          <div className="app-no-drag">
            <NewTerminalButton />
          </div>
        </div>
        <PaneGrid />
      </main>
    </div>
  )
}

export default App
