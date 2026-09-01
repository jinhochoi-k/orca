import { describe, expect, it } from 'vitest'
import {
  getRepoKind,
  getRepoKindLabel,
  hasSourceControl,
  isFolderRepo,
  isGitRepoKind,
  isPerforceRepoKind
} from './repo-kind'

describe('repo kind capabilities', () => {
  it('keeps missing legacy kinds backward-compatible with Git', () => {
    expect(getRepoKind({})).toBe('git')
    expect(isGitRepoKind({})).toBe(true)
  })

  it('uses folder workspace semantics while preserving Perforce source control', () => {
    const repo = { kind: 'perforce' as const }
    expect(isFolderRepo(repo)).toBe(true)
    expect(isPerforceRepoKind(repo)).toBe(true)
    expect(hasSourceControl(repo)).toBe(true)
    expect(getRepoKindLabel(repo)).toBe('Perforce')
  })

  it('does not expose source control for a plain folder', () => {
    expect(hasSourceControl({ kind: 'folder' })).toBe(false)
  })
})
