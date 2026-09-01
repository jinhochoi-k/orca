import { describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../shared/repo-types'
import { migrateExistingLocalFolderRepo } from './local-repo-registration'

function folderRepo(): Repo {
  return {
    id: 'repo-1',
    path: 'C:\\work',
    displayName: 'work',
    badgeColor: '#737373',
    addedAt: 1,
    kind: 'folder'
  }
}

describe('migrateExistingLocalFolderRepo', () => {
  it('preserves the project id while changing an existing folder to Perforce', () => {
    const existing = folderRepo()
    const migrated = { ...existing, kind: 'perforce' as const }
    const updateRepo = vi.fn(() => migrated)

    expect(migrateExistingLocalFolderRepo({ updateRepo }, existing, 'perforce')).toEqual(migrated)
    expect(updateRepo).toHaveBeenCalledWith('repo-1', { kind: 'perforce' })
  })

  it('does not migrate a folder unless Perforce was explicitly requested', () => {
    const existing = folderRepo()
    const updateRepo = vi.fn()

    expect(migrateExistingLocalFolderRepo({ updateRepo }, existing, 'folder')).toBe(existing)
    expect(updateRepo).not.toHaveBeenCalled()
  })
})
