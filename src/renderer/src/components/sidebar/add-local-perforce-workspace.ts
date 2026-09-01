import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { Repo } from '../../../../shared/repo-types'
import type { AddRepoExistingWorkspaceSource } from '../../../../shared/telemetry-events'
import type { RepoSlice } from '@/store/repos/repo-state'
import type { WorktreeFetchOptions } from '@/store/slices/worktree-helpers'
import { worktreeRefreshOptions } from './add-repo-runtime-owner'

export type LocalPathAddResult =
  | { status: 'completed'; repo: Repo }
  | { status: 'cancelled' | 'paused' | 'skipped' }

export async function addLocalPerforceWorkspace({
  path,
  source,
  addRepoPath,
  fetchWorktrees,
  onSourceControlRepoReady,
  setBusyLabel,
  isCurrent,
  deferReady
}: {
  path: string
  source: AddRepoExistingWorkspaceSource
  addRepoPath: RepoSlice['addRepoPath']
  fetchWorktrees: (repoId: string, options?: WorktreeFetchOptions) => Promise<unknown>
  onSourceControlRepoReady: (
    repoId: string,
    source: AddRepoExistingWorkspaceSource,
    executionHostId?: ExecutionHostId
  ) => Promise<void>
  setBusyLabel: (label: string | null) => void
  isCurrent: () => boolean
  deferReady: boolean
}): Promise<LocalPathAddResult | null> {
  const info = await window.api.perforce.info({ worktreePath: path })
  if (!info.available || !info.isWorkspace) {
    return null
  }

  setBusyLabel('Opening Perforce workspace...')
  const repo = await addRepoPath(path, 'perforce', { runtimeEnvironmentId: null })
  if (!repo || !isCurrent()) {
    return { status: repo ? 'cancelled' : 'paused' }
  }

  const ownerOptions = worktreeRefreshOptions(null)
  await fetchWorktrees(repo.id, ownerOptions)
  if (!isCurrent()) {
    return { status: 'cancelled' }
  }
  if (!deferReady) {
    await onSourceControlRepoReady(repo.id, source, ownerOptions.executionHostId)
  }
  return { status: 'completed', repo }
}
