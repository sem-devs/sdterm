import { useEffect, useState } from 'react'
import { FolderOpen, Play } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { paneColorVar } from '@/lib/pane-color'
import { cn } from '@/lib/utils'
import { paneLabel, useWorkspaces, type Workspace } from '@/store/workspace'

const FILE_MANAGER = window.api.platform === 'darwin' ? 'Finder' : 'Explorer'

/** What a parked workspace shows instead of terminals: what it was and how to bring it back. */
export function ParkedWorkspace({ ws }: { ws: Workspace }): React.JSX.Element {
  const setParked = useWorkspaces((s) => s.setParked)
  const [cwds, setCwds] = useState<Record<string, string>>({})
  useEffect(() => void window.api.pty.cwds().then(setCwds), [ws.id])

  const count = ws.panes.length
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-12 py-10">
      <header className="flex max-w-[60ch] flex-col gap-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">{ws.name}</h2>
        <p className="text-muted-foreground text-sm">
          Parked. Its terminals are stopped, so it costs nothing. Names, notes, colors and folders
          are kept, and every terminal starts again where it left off.
        </p>
      </header>

      <div>
        <Button onClick={() => setParked(ws.id, false)} disabled={count === 0}>
          <Play weight="fill" /> Launch {count} {count === 1 ? 'terminal' : 'terminals'}
        </Button>
      </div>

      <ul className="flex max-w-2xl flex-col divide-y border-y">
        {ws.panes.map((p, i) => {
          const folder = cwds[p.id] ?? ws.folder
          return (
            <li key={p.id} className="flex items-start gap-3 py-3">
              <span
                aria-hidden
                className={cn(
                  'mt-1 size-2.5 shrink-0 rounded-[3px]',
                  !p.color && 'border-muted-foreground/60 border'
                )}
                style={p.color ? { backgroundColor: paneColorVar(p.color) } : undefined}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium">{paneLabel(p, i)}</span>
                {p.note && <span className="text-muted-foreground text-xs">{p.note}</span>}
                {folder && (
                  <span className="text-muted-foreground truncate font-mono text-[11px]">
                    {folder}
                  </span>
                )}
              </div>
              {folder && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Show folder in ${FILE_MANAGER}`}
                  title={`Show folder in ${FILE_MANAGER}`}
                  onClick={() => void window.api.app.openFolder(folder)}
                >
                  <FolderOpen />
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
