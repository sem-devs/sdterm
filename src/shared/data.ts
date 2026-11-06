import type { PaneColor, Settings } from './settings'

// What is saved to disk (userData/sdterm.json) and handed to every window at startup.

export interface PersistedPane {
  id: string
  name: string
  note: string
  color: PaneColor | null
}

/** How a workspace arranges its terminals. "auto" picks one from the number of terminals. */
export const LAYOUTS = [
  'auto',
  'columns',
  'rows',
  'grid',
  'main-left',
  'main-right',
  'main-top'
] as const
export type LayoutId = (typeof LAYOUTS)[number]

export interface PersistedWorkspace {
  id: string
  name: string
  /** Which app window shows it: "main", "w2", "w3", ... */
  windowId: string
  /** Parked: its shells are stopped, but names, notes, colors and folders are kept. */
  parked: boolean
  /** The project folder; new terminals in this workspace start here. */
  folder: string
  layout: LayoutId
  /** Size of the main area (or the first of two) as a fraction, or null for the layout's default. */
  split: number | null
  panes: PersistedPane[]
  activePaneId: string | null
}

export interface PersistedWorkspaces {
  workspaces: PersistedWorkspace[]
  /** The selected workspace in each window. */
  activeByWindow: Record<string, string>
}

export const APP_WINDOW_ID = /^(main|w\d{1,2})$/

export interface WidgetBounds {
  x: number
  y: number
  width: number
  height: number
}

export type WidgetKind = 'summary' | 'cpu' | 'cpu-ram' | 'ram' | 'disk' | 'net' | 'processes'

export const WIDGET_DEFS: Record<
  WidgetKind,
  { label: string; width: number; height: number; minHeight: number }
> = {
  summary: { label: 'Resources summary', width: 340, height: 700, minHeight: 360 },
  cpu: { label: 'CPU', width: 320, height: 190, minHeight: 150 },
  'cpu-ram': { label: 'CPU and RAM', width: 320, height: 210, minHeight: 170 },
  ram: { label: 'RAM', width: 320, height: 190, minHeight: 150 },
  disk: { label: 'Disk I/O', width: 320, height: 210, minHeight: 170 },
  net: { label: 'Network I/O', width: 320, height: 210, minHeight: 170 },
  processes: { label: 'Processes', width: 480, height: 560, minHeight: 280 }
}

export const WIDGET_KINDS = Object.keys(WIDGET_DEFS) as WidgetKind[]

export interface StoreData {
  settings: Settings
  workspaces: PersistedWorkspaces | null
  widgetBounds: Partial<Record<WidgetKind, WidgetBounds>>
  /** Last known folder of each terminal's shell. Written only by the main process. */
  paneCwds: Record<string, string>
  windowBounds: Record<string, WidgetBounds>
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

export interface ProcessInfo {
  pid: number
  name: string
  /** Percent of one core, like Activity Monitor and Task Manager (can exceed 100). */
  cpu: number
  /** Resident memory in bytes. */
  rss: number
}

export interface ProcessSnapshot {
  t: number
  cores: number
  memTotal: number
  list: ProcessInfo[]
}

export interface AppInfo {
  name: string
  version: string
  platform: NodeJS.Platform
  storePath: string
}
