import type { PaneColor, Settings } from './settings'

// What is saved to disk (userData/sem-term.json) and handed to every window at startup.

export interface PersistedPane {
  id: string
  name: string
  note: string
  color: PaneColor | null
}

export interface PersistedWorkspace {
  id: string
  name: string
  panes: PersistedPane[]
  activePaneId: string | null
}

export interface PersistedWorkspaces {
  workspaces: PersistedWorkspace[]
  activeWorkspaceId: string
}

export interface WidgetBounds {
  x: number
  y: number
  width: number
  height: number
}

export type WidgetKind = 'summary' | 'cpu' | 'cpu-ram' | 'ram' | 'disk' | 'net'

export const WIDGET_DEFS: Record<
  WidgetKind,
  { label: string; width: number; height: number; minHeight: number }
> = {
  summary: { label: 'Resources summary', width: 340, height: 700, minHeight: 360 },
  cpu: { label: 'CPU', width: 320, height: 190, minHeight: 150 },
  'cpu-ram': { label: 'CPU and RAM', width: 320, height: 210, minHeight: 170 },
  ram: { label: 'RAM', width: 320, height: 190, minHeight: 150 },
  disk: { label: 'Disk I/O', width: 320, height: 210, minHeight: 170 },
  net: { label: 'Network I/O', width: 320, height: 210, minHeight: 170 }
}

export const WIDGET_KINDS = Object.keys(WIDGET_DEFS) as WidgetKind[]

export interface StoreData {
  settings: Settings
  workspaces: PersistedWorkspaces | null
  widgetBounds: Partial<Record<WidgetKind, WidgetBounds>>
}

export type StoreKey = keyof StoreData

export interface ResourceSample {
  t: number
  /** Total CPU use, 0 to 100. */
  cpu: number
  cores: number
  memUsed: number
  memTotal: number
  /** Bytes per second, null when the platform cannot report it. */
  diskRead: number | null
  diskWrite: number | null
  netDown: number | null
  netUp: number | null
}

export interface AppInfo {
  name: string
  version: string
  platform: NodeJS.Platform
  storePath: string
}
