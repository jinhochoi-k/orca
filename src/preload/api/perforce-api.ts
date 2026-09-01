import type {
  PerforceChangelistsResult,
  PerforceInfoResult,
  PerforceMutationResult,
  PerforceShelvedFile,
  PerforceStatusResult
} from '../../shared/perforce-types'

type PerforcePathArgs = {
  worktreePath: string
  filePath: string
}

export type PerforceApi = {
  info: (args: { worktreePath: string }) => Promise<PerforceInfoResult>
  status: (args: {
    worktreePath: string
    includeUnopened?: boolean
  }) => Promise<PerforceStatusResult>
  changelists: (args: {
    worktreePath: string
    includeUnopened?: boolean
  }) => Promise<PerforceChangelistsResult>
  diff: (args: PerforcePathArgs) => Promise<string>
  open: (args: PerforcePathArgs) => Promise<void>
  revert: (args: PerforcePathArgs) => Promise<void>
  submit: (args: { worktreePath: string; message: string }) => Promise<PerforceMutationResult>
  shelve: (args: { worktreePath: string; message: string }) => Promise<PerforceMutationResult>
  createChangelist: (args: {
    worktreePath: string
    description: string
  }) => Promise<PerforceMutationResult>
  moveFiles: (args: {
    worktreePath: string
    changelist: string
    filePaths: string[]
  }) => Promise<void>
  shelvedFiles: (args: {
    worktreePath: string
    changelist: string
  }) => Promise<PerforceShelvedFile[]>
  shelvedDiff: (args: {
    worktreePath: string
    changelist: string
    depotPath: string
  }) => Promise<string>
  sync: (args: { worktreePath: string }) => Promise<void>
}
