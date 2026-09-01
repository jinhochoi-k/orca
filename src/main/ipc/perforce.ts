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
  ipcMain.handle('perforce:sync', (_event, args: { worktreePath: string }) =>
    provider.sync(args.worktreePath)
  )
}
