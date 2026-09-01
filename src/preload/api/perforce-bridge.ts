import { ipcRenderer } from 'electron'
import type { PerforceApi } from './perforce-api'

export const perforceApi: PerforceApi = {
  info: (args) => ipcRenderer.invoke('perforce:info', args),
  status: (args) => ipcRenderer.invoke('perforce:status', args),
  changelists: (args) => ipcRenderer.invoke('perforce:changelists', args),
  diff: (args) => ipcRenderer.invoke('perforce:diff', args),
  open: (args) => ipcRenderer.invoke('perforce:open', args),
  revert: (args) => ipcRenderer.invoke('perforce:revert', args),
  submit: (args) => ipcRenderer.invoke('perforce:submit', args),
  shelve: (args) => ipcRenderer.invoke('perforce:shelve', args),
  createChangelist: (args) => ipcRenderer.invoke('perforce:create-changelist', args),
  moveFiles: (args) => ipcRenderer.invoke('perforce:move-files', args),
  shelvedFiles: (args) => ipcRenderer.invoke('perforce:shelved-files', args),
  shelvedDiff: (args) => ipcRenderer.invoke('perforce:shelved-diff', args),
  sync: (args) => ipcRenderer.invoke('perforce:sync', args)
}
