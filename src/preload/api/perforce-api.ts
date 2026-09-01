import type {
  PerforceInfoResult,
  PerforceMutationResult,
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
  diff: (args: PerforcePathArgs) => Promise<string>
  open: (args: PerforcePathArgs) => Promise<void>
  revert: (args: PerforcePathArgs) => Promise<void>
  submit: (args: { worktreePath: string; message: string }) => Promise<PerforceMutationResult>
  shelve: (args: { worktreePath: string; message: string }) => Promise<PerforceMutationResult>
  sync: (args: { worktreePath: string }) => Promise<void>
}
