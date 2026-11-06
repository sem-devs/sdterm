import { create } from 'zustand'
import { PANE_COLORS, type PaneColor } from '@shared/settings'
import type { PersistedWorkspaces } from '@shared/data'
import { useSettings } from '@/store/settings'

export interface Pane {
  id: string
  /** Chosen by the user. Empty means "use the process title". */
  name: string
  note: string
  color: PaneColor | null
  /** Title set by the running program (OSC), not saved. */
  autoTitle: string
}

export interface Workspace {
  id: string
  name: string
  panes: Pane[]
  activePaneId: string | null
}

interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspaceId: string
  addWorkspace: () => void
  renameWorkspace: (id: string, name: string) => void
  setActiveWorkspace: (id: string) => void
  addPane: () => void
  closePane: (paneId: string) => void
  focusPane: (paneId: string) => void
  updatePane: (paneId: string, patch: Partial<Pick<Pane, 'name' | 'note' | 'color'>>) => void
  setAutoTitle: (paneId: string, title: string) => void
}

const uid = (): string => crypto.randomUUID()

/** First palette colour not yet used in the workspace, cycling once all are taken. */
function nextColor(panes: Pane[]): PaneColor | null {
  if (!useSettings.getState().settings.workspaces.autoColor) return null
  const used = new Set(panes.map((p) => p.color))
  return PANE_COLORS.find((c) => !used.has(c)) ?? PANE_COLORS[panes.length % PANE_COLORS.length]
}

function newPane(panes: Pane[]): Pane {
  return { id: uid(), name: '', note: '', color: nextColor(panes), autoTitle: '' }
}

function newWorkspace(n: number): Workspace {
  const pane = newPane([])
  return { id: uid(), name: `Workspace ${n}`, panes: [pane], activePaneId: pane.id }
}

function initialState(): Pick<WorkspaceState, 'workspaces' | 'activeWorkspaceId'> {
  const saved = window.api.initial.workspaces
  if (saved && useSettings.getState().settings.workspaces.restoreOnLaunch) {
    return {
      workspaces: saved.workspaces.map((w) => ({
        ...w,
        panes: w.panes.map((p) => ({ ...p, autoTitle: '' }))
      })),
      activeWorkspaceId: saved.activeWorkspaceId
    }
  }
  const first = newWorkspace(1)
  return { workspaces: [first], activeWorkspaceId: first.id }
}

const mapWorkspace = (
  list: Workspace[],
  id: string,
  fn: (w: Workspace) => Workspace
): Workspace[] => list.map((w) => (w.id === id ? fn(w) : w))

export const useWorkspaces = create<WorkspaceState>((set) => ({
  ...initialState(),

  addWorkspace: () =>
    set((s) => {
      const ws = newWorkspace(s.workspaces.length + 1)
      return { workspaces: [...s.workspaces, ws], activeWorkspaceId: ws.id }
    }),

  renameWorkspace: (id, name) =>
    set((s) => ({ workspaces: mapWorkspace(s.workspaces, id, (w) => ({ ...w, name })) })),

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  addPane: () =>
    set((s) => ({
      workspaces: mapWorkspace(s.workspaces, s.activeWorkspaceId, (w) => {
        const pane = newPane(w.panes)
        return { ...w, panes: [...w.panes, pane], activePaneId: pane.id }
      })
    })),

  closePane: (paneId) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => {
        if (!w.panes.some((p) => p.id === paneId)) return w
        const panes = w.panes.filter((p) => p.id !== paneId)
        const activePaneId =
          w.activePaneId === paneId ? (panes[panes.length - 1]?.id ?? null) : w.activePaneId
        return { ...w, panes, activePaneId }
      })
    })),

  focusPane: (paneId) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.panes.some((p) => p.id === paneId) ? { ...w, activePaneId: paneId } : w
      )
    })),

  updatePane: (paneId, patch) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        panes: w.panes.map((p) => (p.id === paneId ? { ...p, ...patch } : p))
      }))
    })),

  setAutoTitle: (paneId, autoTitle) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        panes: w.panes.map((p) => (p.id === paneId ? { ...p, autoTitle } : p))
      }))
    }))
}))

/** What the user sees for a pane: their own name, else the program's title, else a number. */
export function paneLabel(pane: Pane, index: number): string {
  return pane.name.trim() || pane.autoTitle.trim() || `Terminal ${index + 1}`
}

function serialize(): PersistedWorkspaces {
  const { workspaces, activeWorkspaceId } = useWorkspaces.getState()
  return {
    activeWorkspaceId,
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      activePaneId: w.activePaneId,
      panes: w.panes.map(({ id, name, note, color }) => ({ id, name, note, color }))
    }))
  }
}

/** Saves names, notes, colours and layout. Only the main window calls this, never pop-outs. */
export function startWorkspacePersistence(): () => void {
  let last = JSON.stringify(serialize())
  return useWorkspaces.subscribe(() => {
    // Program-set titles change constantly and are not saved, so skip no-op writes.
    const next = serialize()
    const json = JSON.stringify(next)
    if (json === last) return
    last = json
    window.api.store.set('workspaces', next)
  })
}
