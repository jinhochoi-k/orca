import { readFile } from 'node:fs/promises'
import { isBinaryPerforceFile } from '../../shared/perforce-file-type'
import type { PerforceFileEntry, PerforceOpenedFileContent } from '../../shared/perforce-types'
import { requirePerforceWorkspacePath, runPerforceChecked, type PerforceRun } from './command'

export type PerforceReadTextFile = (path: string, encoding: 'utf8') => Promise<string>

const defaultReadTextFile: PerforceReadTextFile = (path, encoding) => readFile(path, encoding)

export async function loadPerforceOpenedFileContent(
  run: PerforceRun,
  worktreePath: string,
  file: PerforceFileEntry,
  readTextFile: PerforceReadTextFile = defaultReadTextFile
): Promise<PerforceOpenedFileContent> {
  const target = requirePerforceWorkspacePath(worktreePath, file.path)
  const originalExists = file.status !== 'added'
  const modifiedExists = file.status !== 'deleted'
  if (isBinaryPerforceFile(file.path, file.fileType)) {
    return {
      originalContent: '',
      modifiedContent: '',
      originalIsBinary: originalExists,
      modifiedIsBinary: modifiedExists
    }
  }
  const revision = file.revision && /^\d+$/.test(file.revision) ? file.revision : null
  const depotPath = file.depotPath
  if (originalExists && (!depotPath?.startsWith('//') || /[\r\n@#]/.test(depotPath) || !revision)) {
    throw new Error('Opened Perforce file base revision is unavailable')
  }
  const [originalContent, modifiedContent] = await Promise.all([
    originalExists
      ? runPerforceChecked(run, worktreePath, ['print', '-q', `${depotPath}#${revision}`])
      : Promise.resolve(''),
    modifiedExists ? readTextFile(target, 'utf8') : Promise.resolve('')
  ])
  return {
    originalContent,
    modifiedContent,
    originalIsBinary: false,
    modifiedIsBinary: false
  }
}
