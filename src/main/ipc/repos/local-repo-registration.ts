import { randomUUID } from 'node:crypto'
import type { Store } from '../../persistence'
import type { Repo, RepoKind } from '../../../shared/repo-types'
import { isFolderRepo } from '../../../shared/repo-kind'
import { DEFAULT_REPO_BADGE_COLOR } from '../../../shared/constants'
import { normalizeRuntimePathForComparison } from '../../../shared/cross-platform-path'
import { awaitWindowsHostGitEnvironmentReady } from '../../git/runner'
import {
  isGitRepo,
  getGitRepoRoot,
  getLinkedWorktreeMainRepoRoot,
  getRepoName
} from '../../git/repo'
import { detectRepoIconAndUpstream } from '../../repo-icon-autodetect'
import { prepareLocalWorktreeRootForRepo } from '../../worktree-root-preparation'
import { PerforceProvider } from '../../perforce/provider'

export function migrateExistingLocalFolderRepo(
  store: Pick<Store, 'updateRepo'>,
  existing: Repo,
  requestedKind: RepoKind
): Repo {
  if (requestedKind !== 'perforce' || existing.kind !== 'folder') {
    return existing
  }
  return store.updateRepo(existing.id, { kind: 'perforce' }) ?? existing
}

export async function addLocalRepoFromPath(
  store: Store,
  path: string,
  kind: RepoKind = 'git',
  displayName?: string
): Promise<{ repo: Repo; alreadyExisted: boolean } | { error: string }> {
  const repoKind: RepoKind = kind === 'folder' ? 'folder' : kind === 'perforce' ? 'perforce' : 'git'
  if (repoKind === 'git') {
    await awaitWindowsHostGitEnvironmentReady({ cwd: path })
  }
  if (repoKind === 'git' && !isGitRepo(path)) {
    return { error: `Not a valid git repository: ${path}` }
  }
  if (repoKind === 'perforce') {
    const info = await new PerforceProvider().info(path)
    if (!info.available || !info.isWorkspace) {
      return { error: info.error || `Not a valid Perforce client workspace: ${path}` }
    }
  }

  const resolvedPath = repoKind === 'git' ? getGitRepoRoot(path) : path
  const pathKey = normalizeRuntimePathForComparison(path)
  const existing = store
    .getRepos()
    .find((repo) => !repo.connectionId && normalizeRuntimePathForComparison(repo.path) === pathKey)
  if (existing) {
    return {
      repo: migrateExistingLocalFolderRepo(store, existing, repoKind),
      alreadyExisted: true
    }
  }

  const resolvedPathKey = normalizeRuntimePathForComparison(resolvedPath)
  if (resolvedPathKey !== pathKey) {
    const existingAfterRootResolve = store
      .getRepos()
      .find(
        (repo) =>
          !repo.connectionId && normalizeRuntimePathForComparison(repo.path) === resolvedPathKey
      )
    if (existingAfterRootResolve) {
      return { repo: existingAfterRootResolve, alreadyExisted: true }
    }
  }

  // Why: a linked worktree reports itself as its own toplevel, so the path checks above can't see that
  // it belongs to an already-tracked repo. Adding it anyway yields a second "ready" host setup on the
  // same project and host — a duplicate run-target row that resolves to a transient worktree path.
  if (repoKind === 'git') {
    const mainRepoRoot = getLinkedWorktreeMainRepoRoot(resolvedPath)
    if (mainRepoRoot) {
      const mainRepoKey = normalizeRuntimePathForComparison(mainRepoRoot)
      // Why !isFolderRepo: only a git-kind main checkout projects onto the same project as its
      // worktree, so matching a folder record would suppress the add without deduping anything.
      const trackedMainRepo = store
        .getRepos()
        .find(
          (repo) =>
            !repo.connectionId &&
            !isFolderRepo(repo) &&
            normalizeRuntimePathForComparison(repo.path) === mainRepoKey
        )
      if (trackedMainRepo) {
        return { repo: trackedMainRepo, alreadyExisted: true }
      }
    }
  }

  const detected = await detectRepoIconAndUpstream({ repoPath: resolvedPath, kind: repoKind })
  const repo: Repo = {
    id: randomUUID(),
    path: resolvedPath,
    displayName: displayName?.trim() || getRepoName(resolvedPath),
    badgeColor: DEFAULT_REPO_BADGE_COLOR,
    ...detected,
    addedAt: Date.now(),
    kind: repoKind,
    ...(repoKind === 'git'
      ? {
          externalWorktreeVisibilityLegacy: false,
          // Why: new Add Project imports are explicit ready host setups; 'legacy-repo' is reserved for older records/projection.
          projectHostSetupMethod: 'imported-existing-folder' as const
        }
      : {})
  }

  store.addRepo(repo)
  await prepareLocalWorktreeRootForRepo(store, repo)
  return { repo, alreadyExisted: false }
}
