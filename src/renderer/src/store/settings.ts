import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings } from '@shared/settings'

interface SettingsState {
  settings: Settings
  /** Sets one value, e.g. set('terminal', 'fontSize', 14). Saved to disk by the main process. */
  set: <S extends keyof Settings, K extends keyof Settings[S]>(
    section: S,
    key: K,
    value: Settings[S][K]
  ) => void
  reset: () => void
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: window.api.initial.settings,

  set: (section, key, value) => {
    const current = get().settings
    const next: Settings = { ...current, [section]: { ...current[section], [key]: value } }
    set({ settings: next })
    window.api.store.set('settings', next)
  },

  reset: () => {
    set({ settings: DEFAULT_SETTINGS })
    window.api.store.set('settings', DEFAULT_SETTINGS)
  }
}))

// Changes made in another window (e.g. the main window while a pop-out is open).
window.api.store.onChanged((key, value) => {
  if (key === 'settings') useSettings.setState({ settings: value as Settings })
})
