import { useMemo, useState } from 'react'
import { DotsThree } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useWorkspaces, windowLabel, type Workspace } from '@/store/workspace'

const FILE_MANAGER = window.api.platform === 'darwin' ? 'Finder' : 'Explorer'

function Item({
  children,
  onClick,
  danger,
  disabled
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'hover:bg-accent focus-visible:ring-ring/60 flex min-h-8 w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[13px] outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40',
        danger && 'text-destructive'
      )}
    >
      {children}
    </button>
  )
}

const Label = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <p className="text-muted-foreground px-2 pt-2 pb-1 text-[11px] font-medium">{children}</p>
)

/** Everything you can do with a workspace: rename, set its folder, park, move, delete. */
export function WorkspaceMenu({
  ws,
  onRename,
  className
}: {
  ws: Workspace
  onRename: () => void
  className?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<'park' | 'delete' | null>(null)
  const [busy, setBusy] = useState(0)

  const workspaces = useWorkspaces((s) => s.workspaces)
  const setFolder = useWorkspaces((s) => s.setFolder)
  const setParked = useWorkspaces((s) => s.setParked)
  const moveWorkspace = useWorkspaces((s) => s.moveWorkspace)
  const deleteWorkspace = useWorkspaces((s) => s.deleteWorkspace)

  const windowIds = useMemo(
    () => [...new Set(['main', ...workspaces.map((w) => w.windowId)])].sort(),
    [workspaces]
  )
  const newWindowId = useMemo(() => {
    for (let i = 2; i < 100; i++) if (!windowIds.includes(`w${i}`)) return `w${i}`
    return 'w99'
  }, [windowIds])

  const close = (): void => {
    setOpen(false)
    setConfirm(null)
  }
  const paneIds = ws.panes.map((p) => p.id)

  const park = async (): Promise<void> => {
    if (confirm !== 'park') {
      const running = await window.api.pty.busy(paneIds)
      if (running.length > 0) {
        setBusy(running.length)
        setConfirm('park')
        return
      }
    }
    setParked(ws.id, true)
    void window.api.pty.park(paneIds)
    close()
  }

  const chooseFolder = async (): Promise<void> => {
    const dir = await window.api.app.pickDirectory()
    if (dir) setFolder(ws.id, dir)
  }

  return (
    <Popover open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`${ws.name}: workspace actions`}
          className={cn(
            'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DotsThree weight="bold" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-64 p-1">
        <Item
          onClick={() => {
            close()
            onRename()
          }}
        >
          Rename
        </Item>

        <Label>Project folder</Label>
        <p className="text-muted-foreground truncate px-2 pb-1 font-mono text-[11px]">
          {ws.folder || 'Not set. New terminals start in your home folder.'}
        </p>
        <Item onClick={() => void chooseFolder()}>
          {ws.folder ? 'Change folder…' : 'Choose folder…'}
        </Item>
        {ws.folder && (
          <>
            <Item onClick={() => void window.api.app.openFolder(ws.folder)}>
              Show in {FILE_MANAGER}
            </Item>
            <Item onClick={() => setFolder(ws.id, '')}>Clear folder</Item>
          </>
        )}

        <Label>Workspace</Label>
        {ws.parked ? (
          <Item
            onClick={() => {
              setParked(ws.id, false)
              close()
            }}
          >
            Launch terminals
          </Item>
        ) : (
          <Item onClick={() => void park()}>
            {confirm === 'park'
              ? `${busy} ${busy === 1 ? 'terminal is' : 'terminals are'} running something. Park anyway?`
              : 'Park (stop its terminals)'}
          </Item>
        )}

        <Label>Move to</Label>
        {windowIds
          .filter((id) => id !== ws.windowId)
          .map((id) => (
            <Item
              key={id}
              onClick={() => {
                close()
                moveWorkspace(ws.id, id)
              }}
            >
              {windowLabel(id)}
            </Item>
          ))}
        <Item
          onClick={() => {
            close()
            moveWorkspace(ws.id, newWindowId)
          }}
        >
          New window
        </Item>

        <div className="bg-border my-1 h-px" />
        <Item
          danger
          disabled={workspaces.length <= 1}
          onClick={() => {
            if (confirm !== 'delete') return setConfirm('delete')
            deleteWorkspace(ws.id)
            close()
          }}
        >
          {confirm === 'delete'
            ? `Click again to delete ${ws.panes.length} ${ws.panes.length === 1 ? 'terminal' : 'terminals'}`
            : 'Delete workspace'}
        </Item>
      </PopoverContent>
    </Popover>
  )
}
