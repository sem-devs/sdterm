import type { SemTermApi } from '../shared/ipc'

declare global {
  interface Window {
    api: SemTermApi
  }
}
