import { create } from 'zustand'

export interface Pane {
  id: string
  title: string
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
  setActiveWorkspace: (id: string) => void
  addPane: () => void
  closePane: (paneId: string) => void
  focusPane: (paneId: string) => void
  setPaneTitle: (paneId: string, title: string) => void
}

const uid = (): string => crypto.randomUUID()

function newPane(n: number): Pane {
  return { id: uid(), title: `Terminal ${n}` }
}

function newWorkspace(n: number): Workspace {
  const pane = newPane(1)
  return { id: uid(), name: `Workspace ${n}`, panes: [pane], activePaneId: pane.id }
}

const initial = newWorkspace(1)

export const useWorkspaces = create<WorkspaceState>((set) => ({
  workspaces: [initial],
  activeWorkspaceId: initial.id,

  addWorkspace: () =>
    set((s) => {
      const ws = newWorkspace(s.workspaces.length + 1)
      return { workspaces: [...s.workspaces, ws], activeWorkspaceId: ws.id }
    }),

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  addPane: () =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => {
        if (w.id !== s.activeWorkspaceId) return w
        const pane = newPane(w.panes.length + 1)
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

  setPaneTitle: (paneId, title) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        panes: w.panes.map((p) => (p.id === paneId ? { ...p, title } : p))
      }))
    }))
}))
