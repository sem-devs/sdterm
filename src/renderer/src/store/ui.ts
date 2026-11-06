import { create } from 'zustand'

export type View = 'terminals' | 'settings'

interface UiState {
  view: View
  settingsSection: string
  setView: (view: View) => void
  openSettings: (section?: string) => void
}

export const useUi = create<UiState>((set) => ({
  view: 'terminals',
  settingsSection: 'appearance',
  setView: (view) => set({ view }),
  openSettings: (section) =>
    set((s) => ({ view: 'settings', settingsSection: section ?? s.settingsSection }))
}))
