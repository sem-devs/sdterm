import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type SemTermApi } from '@shared/ipc'

function subscribe<A extends unknown[]>(channel: string, cb: (...args: A) => void): () => void {
  const handler = (_e: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as A))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: SemTermApi = {
  platform: process.platform,
  pty: {
    create: (opts) => ipcRenderer.invoke(IPC.ptyCreate, opts),
    write: (id, data) => ipcRenderer.send(IPC.ptyWrite, id, data),
    resize: (id, cols, rows) => ipcRenderer.send(IPC.ptyResize, id, cols, rows),
    kill: (id) => ipcRenderer.send(IPC.ptyKill, id),
    onData: (cb) => subscribe(IPC.ptyData, cb),
    onExit: (cb) => subscribe(IPC.ptyExit, cb)
  },
  onCommand: (cb) => subscribe(IPC.appCommand, cb),
  setTheme: (mode) => ipcRenderer.send(IPC.setTheme, mode)
}

contextBridge.exposeInMainWorld('api', api)
