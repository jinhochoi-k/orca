import { describe, expect, it, vi } from 'vitest'
import { openPerforceShelvedDiffTab } from './open-perforce-shelved-diff'

describe('openPerforceShelvedDiffTab', () => {
  it('opens a focused Monaco diff tab with stable shelf metadata', () => {
    const openFile = vi.fn(() => 'diff-id')

    openPerforceShelvedDiffTab(openFile, {
      changelist: '123',
      entry: { depotPath: '//depot/main/Feature.cpp', status: 'modified', revision: '7' },
      worktreeId: 'wt-1',
      worktreePath: 'C:\\work'
    })

    expect(openFile).toHaveBeenCalledWith(
      expect.objectContaining({
        relativePath: '//depot/main/Feature.cpp',
        worktreeId: 'wt-1',
        language: 'cpp',
        mode: 'diff',
        diffSource: 'perforce-shelved',
        perforceShelf: expect.objectContaining({ changelist: '123', revision: '7' })
      }),
      { forceContentReload: true, focusEditor: true }
    )
  })
})
