import { detectLanguage } from '@/lib/language-detect'
import { joinPath } from '@/lib/path'
import type { EditorSlice } from '@/store/slices/editor'
import type { PerforceFileEntry } from '../../../../../shared/perforce-types'

export function openPerforceOpenedDiffTab(
  openFile: EditorSlice['openFile'],
  args: {
    entry: PerforceFileEntry
    worktreeId: string
    worktreePath: string
  }
): void {
  const { entry, worktreeId, worktreePath } = args
  openFile(
    {
      filePath: joinPath(worktreePath, entry.path),
      relativePath: entry.path,
      worktreeId,
      language: detectLanguage(entry.path),
      mode: 'diff',
      diffSource: 'perforce-opened',
      perforceOpened: { ...entry, worktreePath }
    },
    { forceContentReload: true, focusEditor: true }
  )
}
