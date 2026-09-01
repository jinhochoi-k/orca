import { detectLanguage } from '@/lib/language-detect'
import { joinPath } from '@/lib/path'
import type { EditorSlice } from '@/store/slices/editor'
import type { PerforceShelvedFile } from '../../../../../shared/perforce-types'

export function openPerforceShelvedDiffTab(
  openFile: EditorSlice['openFile'],
  args: {
    changelist: string
    entry: PerforceShelvedFile
    worktreeId: string
    worktreePath: string
  }
): void {
  const { changelist, entry, worktreeId, worktreePath } = args
  const virtualRelativePath = `.orca-shelved/${changelist}/${entry.depotPath.replace(/^\/+/, '')}`
  openFile(
    {
      filePath: joinPath(worktreePath, virtualRelativePath),
      relativePath: entry.depotPath,
      worktreeId,
      language: detectLanguage(entry.depotPath),
      mode: 'diff',
      diffSource: 'perforce-shelved',
      perforceShelf: { ...entry, changelist, worktreePath }
    },
    { forceContentReload: true, focusEditor: true }
  )
}
