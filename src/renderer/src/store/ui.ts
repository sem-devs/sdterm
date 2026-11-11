import { create } from 'zustand'

export type View = 'terminals' | 'settings'

const SIDEBAR_KEY = 'sdterm.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

interface UiState {
  view: View
  settingsSection: string
  /** The workspace list on the left is hidden. Remembered between launches. */
  sidebarCollapsed: boolean
  setView: (view: View) => void
  openSettings: (section?: string) => void
  toggleSidebar: () => void
}

export const useUi = create<UiState>((set) => ({
  view: 'terminals',
  settingsSection: 'appearance',
  sidebarCollapsed: readCollapsed(),
  setView: (view) => set({ view }),
  openSettings: (section) =>
    set((s) => ({ view: 'settings', settingsSection: section ?? s.settingsSection })),
  toggleSidebar: () =>
    set((s) => {
      const sidebarCollapsed = !s.sidebarCollapsed
      try {
        localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '1' : '0')
      } catch {
        // Not remembered; the toggle still works for this session.
      }
      return { sidebarCollapsed }
    })
}))
