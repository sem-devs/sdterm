import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type SdtermApi } from '@shared/ipc'
import type { StoreData } from '@shared/data'

function subscribe<A extends unknown[]>(channel: string, cb: (...args: A) => void): () => void {
  const handler = (_e: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as A))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

// One IPC listener per channel; panes register here, so 20 terminals do not mean 20 listeners.
function demux<A>(channel: string): (paneId: string, cb: (arg: A) => void) => () => void {
  const handlers = new Map<string, (arg: A) => void>()
  ipcRenderer.on(channel, (_e: IpcRendererEvent, paneId: string, arg: A) =>
    handlers.get(paneId)?.(arg)
  )
  return (paneId, cb) => {
    handlers.set(paneId, cb)
    return () => {
      if (handlers.get(paneId) === cb) handlers.delete(paneId)
    }
  }
}
const onPaneData = demux<string>(IPC.ptyData)
const onPaneExit = demux<number>(IPC.ptyExit)

const api: SdtermApi = {
  platform: process.platform,
  initial: ipcRenderer.sendSync(IPC.storeLoad) as StoreData,
  pty: {
    attach: (opts) => ipcRenderer.invoke(IPC.ptyAttach, opts),
    detach: (paneId, viewId) => ipcRenderer.send(IPC.ptyDetach, paneId, viewId),
    write: (paneId, data) => ipcRenderer.send(IPC.ptyWrite, paneId, data),
    resize: (paneId, cols, rows) => ipcRenderer.send(IPC.ptyResize, paneId, cols, rows),
    kill: (paneId) => ipcRenderer.send(IPC.ptyKill, paneId),
    park: (paneIds) => ipcRenderer.invoke(IPC.ptyPark, paneIds),
    busy: (paneIds) => ipcRenderer.invoke(IPC.ptyBusy, paneIds),
    cwds: () => ipcRenderer.invoke(IPC.ptyCwds),
    cwd: (paneId) => ipcRenderer.invoke(IPC.ptyCwd, paneId),
    reportCwd: (paneId, path) => ipcRenderer.send(IPC.ptyReportCwd, paneId, path),
    onData: onPaneData,
    onExit: onPaneExit
  },
  store: {
    set: (key, value) => ipcRenderer.send(IPC.storeSet, key, value),
    onChanged: (cb) => subscribe(IPC.storeChanged, cb)
  },
  resources: {
    subscribe: () => ipcRenderer.invoke(IPC.resSubscribe),
    unsubscribe: () => ipcRenderer.send(IPC.resUnsubscribe),
    onSample: (cb) => subscribe(IPC.resSample, cb)
  },
  widgets: {
    open: (kind) => ipcRenderer.send(IPC.widgetOpen, kind),
    close: () => ipcRenderer.send(IPC.widgetClose),
    setPinned: (pinned) => ipcRenderer.send(IPC.widgetPin, pinned),
    setSize: (width, height) => ipcRenderer.send(IPC.widgetSetSize, width, height),
    toggleFill: () => ipcRenderer.invoke(IPC.widgetToggleFill)
  },
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo),
    revealStore: () => ipcRenderer.send(IPC.appRevealStore),
    pickDirectory: () => ipcRenderer.invoke(IPC.pickDirectory),
    openFolder: (path) => ipcRenderer.invoke(IPC.openFolder, path)
  },
  processes: {
    subscribe: () => ipcRenderer.invoke(IPC.procSubscribe),
    unsubscribe: () => ipcRenderer.send(IPC.procUnsubscribe),
    onSample: (cb) => subscribe(IPC.procSample, cb)
  },
  windows: {
    open: (id) => ipcRenderer.send(IPC.windowOpen, id)
  },
  onCommand: (cb) => subscribe(IPC.appCommand, cb)
}

contextBridge.exposeInMainWorld('api', api)
