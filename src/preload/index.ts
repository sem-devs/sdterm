import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type SemTermApi } from '@shared/ipc'
import type { StoreData } from '@shared/data'

function subscribe<A extends unknown[]>(channel: string, cb: (...args: A) => void): () => void {
  const handler = (_e: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as A))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: SemTermApi = {
  platform: process.platform,
  initial: ipcRenderer.sendSync(IPC.storeLoad) as StoreData,
  pty: {
    create: (opts) => ipcRenderer.invoke(IPC.ptyCreate, opts),
    write: (id, data) => ipcRenderer.send(IPC.ptyWrite, id, data),
    resize: (id, cols, rows) => ipcRenderer.send(IPC.ptyResize, id, cols, rows),
    kill: (id) => ipcRenderer.send(IPC.ptyKill, id),
    onData: (cb) => subscribe(IPC.ptyData, cb),
    onExit: (cb) => subscribe(IPC.ptyExit, cb)
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
    setPinned: (pinned) => ipcRenderer.send(IPC.widgetPin, pinned)
  },
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo),
    revealStore: () => ipcRenderer.send(IPC.appRevealStore),
    pickDirectory: () => ipcRenderer.invoke(IPC.pickDirectory)
  },
  onCommand: (cb) => subscribe(IPC.appCommand, cb)
}

contextBridge.exposeInMainWorld('api', api)
