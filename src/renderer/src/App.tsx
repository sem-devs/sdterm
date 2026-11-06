import { useEffect } from 'react'
import { LayoutMenu } from '@/components/layout-menu'
import { NewTerminalButton, PaneGrid } from '@/components/pane-grid'
import { SettingsView } from '@/components/settings/settings-view'
import { Sidebar } from '@/components/sidebar'
import { cn } from '@/lib/utils'
import { useUi } from '@/store/ui'
import { selectActive, startWorkspacePersistence, useWorkspaces } from '@/store/workspace'

const isMac = window.api.platform === 'darwin'

function App(): React.JSX.Element {
  const view = useUi((s) => s.view)
  const workspaceName = useWorkspaces((s) => selectActive(s)?.name ?? '')
  const parked = useWorkspaces((s) => selectActive(s)?.parked ?? false)

  useEffect(() => startWorkspacePersistence(), [])

  // Native menu items (and their shortcuts) arrive here as commands.
  useEffect(
    () =>
      window.api.onCommand((cmd) => {
        const s = useWorkspaces.getState()
        const ui = useUi.getState()
        if (cmd === 'open-settings') ui.setView(ui.view === 'settings' ? 'terminals' : 'settings')
        if (cmd === 'new-pane') {
          ui.setView('terminals')
          s.addPane()
        }
        if (cmd === 'new-workspace') {
          ui.setView('terminals')
          s.addWorkspace()
        }
        if (cmd === 'close-pane') {
          const ws = selectActive(s)
          if (ws && !ws.parked && ws.activePaneId) s.closePane(ws.activePaneId)
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
          <h1 className="font-display text-[13px] font-semibold tracking-tight">
            {view === 'settings' ? 'Settings' : workspaceName}
            {view === 'terminals' && parked && (
              <span className="text-muted-foreground ml-2 text-xs font-normal">Parked</span>
            )}
          </h1>
          {view === 'terminals' && !parked && (
            <div className="app-no-drag flex items-center">
              <LayoutMenu />
              <NewTerminalButton />
            </div>
          )}
        </div>
        <PaneGrid hidden={view === 'settings'} />
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}

export default App
