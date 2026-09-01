import type { Repo } from './repo-types'

export function getRepoKind(repo: Pick<Repo, 'kind'>): 'git' | 'perforce' | 'folder' {
  if (repo.kind === 'folder' || repo.kind === 'perforce') {
    return repo.kind
  }
  return 'git'
}

/** True for projects that use Orca's single-root workspace model rather than Git worktrees. */
export function isFolderRepo(repo: Pick<Repo, 'kind'>): boolean {
  return getRepoKind(repo) !== 'git'
}

export function isGitRepoKind(repo: Pick<Repo, 'kind'>): boolean {
  return getRepoKind(repo) === 'git'
}

export function isPerforceRepoKind(repo: Pick<Repo, 'kind'>): boolean {
  return getRepoKind(repo) === 'perforce'
}

export function hasSourceControl(repo: Pick<Repo, 'kind'>): boolean {
  return getRepoKind(repo) !== 'folder'
}

export function getRepoKindLabel(repo: Pick<Repo, 'kind'>): string {
  const kind = getRepoKind(repo)
  return kind === 'perforce' ? 'Perforce' : kind === 'folder' ? 'Folder' : 'Git'
}
