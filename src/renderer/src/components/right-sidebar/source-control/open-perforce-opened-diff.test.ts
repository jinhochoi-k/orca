import { describe, expect, it, vi } from 'vitest'
import { openPerforceOpenedDiffTab } from './open-perforce-opened-diff'

describe('openPerforceOpenedDiffTab', () => {
  it('opens an opened text file in a focused editor diff tab', () => {
    const openFile = vi.fn()
    openPerforceOpenedDiffTab(openFile, {
      entry: {
        path: 'Source/Main.cpp',
        depotPath: '//PUBG/mainline/Source/Main.cpp',
        revision: '12',
        fileType: 'text',
        status: 'modified',
        area: 'staged',
        changelist: '123'
      },
      worktreeId: 'worktree-1',
      worktreePath: 'C:\\work'
    })

    expect(openFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: 'C:\\work\\Source\\Main.cpp',
        relativePath: 'Source/Main.cpp',
        worktreeId: 'worktree-1',
        mode: 'diff',
        diffSource: 'perforce-opened',
        perforceOpened: expect.objectContaining({
          changelist: '123',
          revision: '12',
          worktreePath: 'C:\\work'
        })
      }),
      { forceContentReload: true, focusEditor: true }
    )
  })
})
