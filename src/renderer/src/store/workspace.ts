import { create } from 'zustand'
import { PANE_COLORS, type PaneColor } from '@shared/settings'
import type { LayoutId, PersistedWorkspaces } from '@shared/data'
import { useSettings } from '@/store/settings'

/** Which app window this renderer is: "main", or "w2", "w3"... for extra windows. */
export const WINDOW_ID = new URLSearchParams(window.location.search).get('window') ?? 'main'

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
  windowId: string
  /** Parked: shells stopped, everything else kept. */
  parked: boolean
  /** Project folder; new terminals start here. */
  folder: string
  layout: LayoutId
  split: number | null
  panes: Pane[]
  activePaneId: string | null
}

interface WorkspaceState {
  /** Every workspace of every window; a window shows the ones with its own id. */
  workspaces: Workspace[]
  activeByWindow: Record<string, string>
  addWorkspace: () => void
  renameWorkspace: (id: string, name: string) => void
  setActiveWorkspace: (id: string) => void
  setFolder: (id: string, folder: string) => void
  setParked: (id: string, parked: boolean) => void
  setLayout: (id: string, layout: LayoutId) => void
  setSplit: (id: string, split: number) => void
  /** Swaps two terminals' places (drag one onto another). */
  swapPanes: (a: string, b: string) => void
  /** Moves a terminal to the end of another workspace. */
  movePane: (paneId: string, workspaceId: string) => void
  moveWorkspace: (id: string, windowId: string) => void
  deleteWorkspace: (id: string) => void
  addPane: () => void
  closePane: (paneId: string) => void
  focusPane: (paneId: string) => void
  updatePane: (paneId: string, patch: Partial<Pick<Pane, 'name' | 'note' | 'color'>>) => void
  setAutoTitle: (paneId: string, title: string) => void
  applyRemote: (model: PersistedWorkspaces) => void
}

const uid = (): string => crypto.randomUUID()

export const windowLabel = (id: string): string =>
  id === 'main' ? 'Main window' : `Window ${id.slice(1)}`

export const workspacesOf = (list: Workspace[], windowId = WINDOW_ID): Workspace[] =>
  list.filter((w) => w.windowId === windowId)

type Snapshot = Pick<WorkspaceState, 'workspaces' | 'activeByWindow'>

/** The workspace this window is showing. */
export function selectActive(s: Snapshot): Workspace | undefined {
  const mine = workspacesOf(s.workspaces)
  return mine.find((w) => w.id === s.activeByWindow[WINDOW_ID]) ?? mine[0]
}

/** First palette colour not yet used in the workspace, cycling once all are taken. */
function nextColor(panes: Pane[]): PaneColor | null {
  if (!useSettings.getState().settings.workspaces.autoColor) return null
  const used = new Set(panes.map((p) => p.color))
  return PANE_COLORS.find((c) => !used.has(c)) ?? PANE_COLORS[panes.length % PANE_COLORS.length]
}

function newPane(panes: Pane[]): Pane {
  return { id: uid(), name: '', note: '', color: nextColor(panes), autoTitle: '' }
}

function newWorkspace(n: number, windowId: string): Workspace {
  const pane = newPane([])
  return {
    id: uid(),
    name: `Workspace ${n}`,
    windowId,
    parked: false,
    folder: '',
    layout: 'auto',
    split: null,
    panes: [pane],
    activePaneId: pane.id
  }
}

function initialState(): Snapshot {
  const saved = window.api.initial.workspaces
  if (saved && useSettings.getState().settings.workspaces.restoreOnLaunch) {
    return {
      workspaces: saved.workspaces.map((w) => ({
        ...w,
        panes: w.panes.map((p) => ({ ...p, autoTitle: '' }))
      })),
      activeByWindow: saved.activeByWindow
    }
  }
  const first = newWorkspace(1, 'main')
  return { workspaces: [first], activeByWindow: { main: first.id } }
}

const mapWorkspace = (
  list: Workspace[],
  id: string,
  fn: (w: Workspace) => Workspace
): Workspace[] => list.map((w) => (w.id === id ? fn(w) : w))

/** After removing a workspace from a window, select another one there (or none). */
function reselect(
  workspaces: Workspace[],
  activeByWindow: Record<string, string>,
  windowId: string
): Record<string, string> {
  const next = { ...activeByWindow }
  const stillThere = workspaces.some((w) => w.id === next[windowId] && w.windowId === windowId)
  if (stillThere) return next
  const fallback = workspaces.find((w) => w.windowId === windowId)
  if (fallback) next[windowId] = fallback.id
  else delete next[windowId]
  return next
}

export const useWorkspaces = create<WorkspaceState>((set, get) => ({
  ...initialState(),

  addWorkspace: () =>
    set((s) => {
      const ws = newWorkspace(s.workspaces.length + 1, WINDOW_ID)
      return {
        workspaces: [...s.workspaces, ws],
        activeByWindow: { ...s.activeByWindow, [WINDOW_ID]: ws.id }
      }
    }),

  renameWorkspace: (id, name) =>
    set((s) => ({ workspaces: mapWorkspace(s.workspaces, id, (w) => ({ ...w, name })) })),

  setActiveWorkspace: (id) =>
    set((s) => ({ activeByWindow: { ...s.activeByWindow, [WINDOW_ID]: id } })),

  setFolder: (id, folder) =>
    set((s) => ({ workspaces: mapWorkspace(s.workspaces, id, (w) => ({ ...w, folder })) })),

  setParked: (id, parked) =>
    set((s) => ({ workspaces: mapWorkspace(s.workspaces, id, (w) => ({ ...w, parked })) })),

  setLayout: (id, layout) =>
    set((s) => ({
      workspaces: mapWorkspace(s.workspaces, id, (w) => ({ ...w, layout, split: null }))
    })),

  setSplit: (id, split) =>
    set((s) => ({
      workspaces: mapWorkspace(s.workspaces, id, (w) => ({
        ...w,
        split: Math.min(0.8, Math.max(0.2, split))
      }))
    })),

  swapPanes: (a, b) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => {
        const i = w.panes.findIndex((p) => p.id === a)
        const j = w.panes.findIndex((p) => p.id === b)
        if (i < 0 || j < 0 || i === j) return w
        const panes = [...w.panes]
        ;[panes[i], panes[j]] = [panes[j], panes[i]]
        return { ...w, panes }
      })
    })),

  movePane: (paneId, workspaceId) =>
    set((s) => {
      const from = s.workspaces.find((w) => w.panes.some((p) => p.id === paneId))
      const to = s.workspaces.find((w) => w.id === workspaceId)
      if (!from || !to || from.id === to.id || to.parked) return s
      const pane = from.panes.find((p) => p.id === paneId)!
      return {
        workspaces: s.workspaces.map((w) => {
          if (w.id === from.id) {
            const panes = w.panes.filter((p) => p.id !== paneId)
            return {
              ...w,
              panes,
              activePaneId: w.activePaneId === paneId ? (panes[0]?.id ?? null) : w.activePaneId
            }
          }
          if (w.id === to.id) return { ...w, panes: [...w.panes, pane], activePaneId: pane.id }
          return w
        })
      }
    }),

  moveWorkspace: (id, windowId) => {
    const ws = get().workspaces.find((w) => w.id === id)
    if (!ws || ws.windowId === windowId) return
    const from = ws.windowId
    set((s) => {
      const workspaces = mapWorkspace(s.workspaces, id, (w) => ({ ...w, windowId }))
      const activeByWindow = reselect(workspaces, s.activeByWindow, from)
      activeByWindow[windowId] = id // show it where it landed
      return { workspaces, activeByWindow }
    })
    // The new layout has already been sent to the main process, so a window opened now loads it.
    window.api.windows.open(windowId)
  },

  deleteWorkspace: (id) => {
    const ws = get().workspaces.find((w) => w.id === id)
    if (!ws) return
    ws.panes.forEach((p) => window.api.pty.kill(p.id))
    set((s) => {
      const workspaces = s.workspaces.filter((w) => w.id !== id)
      return { workspaces, activeByWindow: reselect(workspaces, s.activeByWindow, ws.windowId) }
    })
  },

  addPane: () =>
    set((s) => {
      const active = selectActive(s)
      if (!active) return s
      return {
        workspaces: mapWorkspace(s.workspaces, active.id, (w) => {
          const pane = newPane(w.panes)
          return { ...w, panes: [...w.panes, pane], activePaneId: pane.id }
        })
      }
    }),

  closePane: (paneId) => {
    window.api.pty.kill(paneId)
    set((s) => ({
      workspaces: s.workspaces.map((w) => {
        if (!w.panes.some((p) => p.id === paneId)) return w
        const panes = w.panes.filter((p) => p.id !== paneId)
        const activePaneId =
          w.activePaneId === paneId ? (panes[panes.length - 1]?.id ?? null) : w.activePaneId
        return { ...w, panes, activePaneId }
      })
    }))
  },

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
    })),

  applyRemote: (model) =>
    set((s) => {
      const titles = new Map(s.workspaces.flatMap((w) => w.panes.map((p) => [p.id, p.autoTitle])))
      const before = new Set(workspacesOf(s.workspaces).map((w) => w.id))
      const workspaces = model.workspaces.map((w) => ({
        ...w,
        panes: w.panes.map((p) => ({ ...p, autoTitle: titles.get(p.id) ?? '' }))
      }))
      // Each window owns its own selection; only take another window's choice for mine when a
      // workspace has just been moved here.
      const remoteMine = model.activeByWindow[WINDOW_ID]
      const arrived = remoteMine !== undefined && !before.has(remoteMine)
      const activeByWindow = { ...model.activeByWindow }
      if (!arrived && s.activeByWindow[WINDOW_ID])
        activeByWindow[WINDOW_ID] = s.activeByWindow[WINDOW_ID]
      return { workspaces, activeByWindow: reselect(workspaces, activeByWindow, WINDOW_ID) }
    })
}))

/** What the user sees for a pane: their own name, else the program's title, else a number. */
export function paneLabel(pane: Pane, index: number): string {
  return pane.name.trim() || pane.autoTitle.trim() || `Terminal ${index + 1}`
}

function serialize(): PersistedWorkspaces {
  const { workspaces, activeByWindow } = useWorkspaces.getState()
  return {
    activeByWindow,
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      windowId: w.windowId,
      parked: w.parked,
      folder: w.folder,
      layout: w.layout,
      split: w.split,
      activePaneId: w.activePaneId,
      panes: w.panes.map(({ id, name, note, color }) => ({ id, name, note, color }))
    }))
  }
}

/**
 * Saves names, notes, colours, folders, parked state and the window layout, and follows changes
 * made in other windows. Only app windows call this, never pop-outs.
 */
export function startWorkspacePersistence(): () => void {
  let last = JSON.stringify(serialize())
  let applyingRemote = false

  const offLocal = useWorkspaces.subscribe(() => {
    if (applyingRemote) return
    // Program-set titles change constantly and are not saved, so skip no-op writes.
    const next = serialize()
    const json = JSON.stringify(next)
    if (json === last) return
    last = json
    window.api.store.set('workspaces', next)
  })

  const offRemote = window.api.store.onChanged((key, value) => {
    if (key !== 'workspaces' || !value) return
    applyingRemote = true
    try {
      useWorkspaces.getState().applyRemote(value as PersistedWorkspaces)
    } finally {
      applyingRemote = false
    }
    last = JSON.stringify(serialize())
  })

  return () => {
    offLocal()
    offRemote()
  }
}
