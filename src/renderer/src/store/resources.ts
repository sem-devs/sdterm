import { useEffect } from 'react'
import { create } from 'zustand'
import type { ResourceSample } from '@shared/data'

/** One chart window of history: 60 samples is two minutes at the default 2 s interval. */
export const WINDOW = 60

interface ResourceState {
  samples: ResourceSample[]
  setHistory: (history: ResourceSample[]) => void
  push: (sample: ResourceSample) => void
}

export const useResources = create<ResourceState>((set) => ({
  samples: [],
  setHistory: (history) => set({ samples: history.slice(-WINDOW) }),
  push: (sample) => set((s) => ({ samples: [...s.samples, sample].slice(-WINDOW) }))
}))

/** Subscribes this window to the main-process sampler while `enabled`. */
export function useResourceFeed(enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const { resources } = window.api
    const { setHistory, push } = useResources.getState()
    let live = true
    const off = resources.onSample(push)
    void resources.subscribe().then((history) => live && setHistory(history))
    return () => {
      live = false
      off()
      resources.unsubscribe()
    }
  }, [enabled])
}
