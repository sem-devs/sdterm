import { useEffect } from 'react'
import { create } from 'zustand'
import type { ProcessSnapshot } from '@shared/data'

interface ProcessState {
  snapshot: ProcessSnapshot | null
  set: (snapshot: ProcessSnapshot) => void
}

export const useProcesses = create<ProcessState>((set) => ({
  snapshot: null,
  set: (snapshot) => set({ snapshot })
}))

/** Subscribes this window to the process list while `enabled` (it is sampled only on demand). */
export function useProcessFeed(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const { processes } = window.api
    const { set } = useProcesses.getState()
    let live = true
    const off = processes.onSample(set)
    void processes.subscribe().then((first) => live && first && set(first))
    return () => {
      live = false
      off()
      processes.unsubscribe()
    }
  }, [enabled])
}
