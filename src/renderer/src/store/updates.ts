import { create } from 'zustand'
import type { UpdateState } from '@shared/data'

interface UpdatesState {
  state: UpdateState
  /** The user pressed Update: only then is a failure worth a banner (a failed background check is not). */
  installing: boolean
  startInstall: () => void
}

export const useUpdates = create<UpdatesState>((set) => ({
  state: { status: 'idle' },
  installing: false,
  startInstall: () => {
    set({ installing: true })
    void window.api.updates.install()
  }
}))

void window.api.updates.get().then((state) => useUpdates.setState({ state }))
window.api.updates.onState((state) => useUpdates.setState({ state }))
