import { ipcMain } from 'electron'
import type { Store } from '../persistence'
import { PerforceProvider } from '../perforce/provider'
import { getPerforceSubmitPolicy } from '../perforce/submit-policy'

export function registerPerforceHandlers(store: Store, provider = new PerforceProvider()): void {
  ipcMain.handle('perforce:info', (_event, args: { worktreePath: string }) =>
    provider.info(args.worktreePath)
  )
  ipcMain.handle(
    'perforce:status',
    (_event, args: { worktreePath: string; includeUnopened?: boolean }) =>
      provider.status(args.worktreePath, { includeUnopened: args.includeUnopened === true })
  )
  ipcMain.handle(
    'perforce:changelists',
    (_event, args: { worktreePath: string; includeUnopened?: boolean }) =>
      provider.changelists(args.worktreePath, { includeUnopened: args.includeUnopened === true })
  )
  ipcMain.handle('perforce:diff', (_event, args: { worktreePath: string; filePath: string }) =>
    provider.diff(args.worktreePath, args.filePath)
  )
  ipcMain.handle('perforce:open', (_event, args: { worktreePath: string; filePath: string }) =>
    provider.open(args.worktreePath, args.filePath)
  )
  ipcMain.handle('perforce:revert', (_event, args: { worktreePath: string; filePath: string }) =>
    provider.revert(args.worktreePath, args.filePath)
  )
  ipcMain.handle('perforce:submit', (_event, args: { worktreePath: string; message: string }) => {
    const policy = getPerforceSubmitPolicy(store.getRepos(), args.worktreePath)
    return policy.allowed
      ? provider.submit(args.worktreePath, args.message)
      : { success: false, error: policy.error }
  })
  ipcMain.handle('perforce:shelve', (_event, args: { worktreePath: string; message: string }) =>
    provider.shelve(args.worktreePath, args.message)
  )
  ipcMain.handle(
    'perforce:create-changelist',
    (_event, args: { worktreePath: string; description: string }) =>
      provider.createPendingChangelist(args.worktreePath, args.description)
  )
  ipcMain.handle(
    'perforce:move-files',
    (_event, args: { worktreePath: string; changelist: string; filePaths: string[] }) =>
      provider.moveFiles(args.worktreePath, args.changelist, args.filePaths)
  )
  ipcMain.handle(
    'perforce:shelved-files',
    (_event, args: { worktreePath: string; changelist: string }) =>
      provider.shelvedFiles(args.worktreePath, args.changelist)
  )
  ipcMain.handle(
    'perforce:shelved-diff',
    (_event, args: { worktreePath: string; changelist: string; depotPath: string }) =>
      provider.shelvedDiff(args.worktreePath, args.changelist, args.depotPath)
  )
  ipcMain.handle('perforce:sync', (_event, args: { worktreePath: string }) =>
    provider.sync(args.worktreePath)
  )
}
