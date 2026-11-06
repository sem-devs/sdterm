import type { SdtermApi } from '../shared/ipc'

declare global {
  interface Window {
    api: SdtermApi
  }
}
