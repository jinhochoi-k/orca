import type { GitFileStatus, GitStagingArea } from './git-status-types'

export type PerforceFileEntry = {
  path: string
  status: GitFileStatus
  area: GitStagingArea
  changelist?: string
  depotPath?: string
}

export type PerforceStatusResult = {
  entries: PerforceFileEntry[]
  client?: string
  stream?: string
  user?: string
}

export type PerforceInfoResult = {
  available: boolean
  isWorkspace: boolean
  client?: string
  clientRoot?: string
  stream?: string
  user?: string
  serverAddress?: string
  error?: string
}

export type PerforceMutationResult = {
  success: boolean
  changelist?: string
  error?: string
}
