import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import type { Repo } from '../../shared/repo-types'

export type PerforceSubmitPolicy = { allowed: true } | { allowed: false; error: string }

export function getPerforceSubmitPolicy(
  repos: readonly Repo[],
  worktreePath: string
): PerforceSubmitPolicy {
  const pathKey = normalizeRuntimePathForComparison(worktreePath)
  const repo = repos.find(
    (candidate) =>
      candidate.kind === 'perforce' && normalizeRuntimePathForComparison(candidate.path) === pathKey
  )
  if (!repo) {
    return { allowed: false, error: 'Perforce workspace is not registered in Orca' }
  }
  return repo.perforceSubmitDisabled === true
    ? { allowed: false, error: 'Perforce submit is disabled for this project' }
    : { allowed: true }
}
