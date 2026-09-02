import { join, relative } from 'node:path'
import { runProcess } from '../../shared/child-process/run-process'
import type {
  PerforceChangelistsResult,
  PerforceFileEntry,
  PerforceInfoResult,
  PerforceMutationResult,
  PerforceShelvedFile,
  PerforceStatusResult
} from '../../shared/perforce-types'
import {
  createPendingPerforceChangelist,
  createPerforceChangelist,
  extractShelvedFileDiff,
  listPerforceChangelists,
  loadPerforceShelvedDiff,
  loadPerforceShelvedFileContent,
  loadPerforceShelvedFiles,
  movePerforceFiles
} from './changelist-operations'
import {
  isPathInsideOrEqual,
  mapPerforceAction,
  optionalPerforceStatusOutput,
  parseP4TaggedOutput,
  perforceErrorText,
  requirePerforceWorkspacePath,
  runPerforceChecked,
  type PerforceRun,
  type TaggedRecord
} from './command'

export { extractShelvedFileDiff, parseP4TaggedOutput }
export type { PerforceRun }

const P4_TIMEOUT_MS = 30_000
const P4_STATUS_TIMEOUT_MS = 120_000
const P4_SYNC_TIMEOUT_MS = 10 * 60_000

const defaultRun: PerforceRun = async (args, options) =>
  runProcess({
    program: 'p4',
    args: [...args],
    cwd: options.cwd,
    input: options.input,
    timeoutMs: options.timeoutMs ?? P4_TIMEOUT_MS
  })

function entryFromRecord(
  record: TaggedRecord,
  root: string,
  opened: boolean,
  info: PerforceInfoResult
): PerforceFileEntry | null {
  let clientFile = record.clientFile || record.path
  const clientPrefix = info.client ? `//${info.client}/` : ''
  if (
    clientFile &&
    info.clientRoot &&
    clientPrefix &&
    clientFile.toLocaleLowerCase().startsWith(clientPrefix.toLocaleLowerCase())
  ) {
    clientFile = join(info.clientRoot, ...clientFile.slice(clientPrefix.length).split('/'))
  }
  if (!clientFile || !isPathInsideOrEqual(root, clientFile)) {
    return null
  }
  const path = relative(root, clientFile).replaceAll('\\', '/')
  const mapped = mapPerforceAction(record.action || record.type || '')
  return {
    path,
    status: mapped.status,
    area: opened ? 'staged' : mapped.status === 'added' ? 'untracked' : 'unstaged',
    ...(record.change ? { changelist: record.change } : {}),
    ...(record.depotFile ? { depotPath: record.depotFile } : {})
  }
}

export class PerforceProvider {
  constructor(private readonly run: PerforceRun = defaultRun) {}

  async info(worktreePath: string): Promise<PerforceInfoResult> {
    let result: Awaited<ReturnType<PerforceRun>>
    try {
      result = await this.run(['-ztag', 'info'], { cwd: worktreePath, timeoutMs: P4_TIMEOUT_MS })
    } catch (error) {
      return {
        available: false,
        isWorkspace: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
    if (result.code !== 0) {
      return { available: true, isWorkspace: false, error: perforceErrorText(result) }
    }
    const info = parseP4TaggedOutput(result.stdout)[0] ?? {}
    const client = info.clientName
    const clientRoot = info.clientRoot
    return {
      available: true,
      isWorkspace: Boolean(
        client &&
        client !== '*unknown*' &&
        clientRoot &&
        isPathInsideOrEqual(clientRoot, worktreePath)
      ),
      ...(client ? { client } : {}),
      ...(clientRoot ? { clientRoot } : {}),
      ...(info.clientStream ? { stream: info.clientStream } : {}),
      ...(info.userName ? { user: info.userName } : {}),
      ...(info.serverAddress ? { serverAddress: info.serverAddress } : {})
    }
  }

  async status(
    worktreePath: string,
    options: { includeUnopened?: boolean } = {},
    knownInfo?: PerforceInfoResult
  ): Promise<PerforceStatusResult> {
    const info = knownInfo ?? (await this.info(worktreePath))
    if (!info.available || !info.isWorkspace) {
      throw new Error(info.error || 'Not a valid Perforce client workspace')
    }
    const [openedResult, reconcileResult] = await Promise.all([
      this.run(['-ztag', 'opened', '...'], { cwd: worktreePath }),
      options.includeUnopened
        ? this.run(['-ztag', 'reconcile', '-n', '-e', '-a', '-d', '...'], {
            cwd: worktreePath,
            timeoutMs: P4_STATUS_TIMEOUT_MS
          })
        : Promise.resolve({ code: 0, stdout: '', stderr: '' })
    ])
    const openedOutput = optionalPerforceStatusOutput(openedResult)
    const reconcileOutput = optionalPerforceStatusOutput(reconcileResult)
    const opened = parseP4TaggedOutput(openedOutput)
      .map((record) => entryFromRecord(record, worktreePath, true, info))
      .filter((entry): entry is PerforceFileEntry => entry !== null)
    const openedPaths = new Set(opened.map((entry) => entry.path.toLocaleLowerCase()))
    const unopened = parseP4TaggedOutput(reconcileOutput)
      .map((record) => entryFromRecord(record, worktreePath, false, info))
      .filter(
        (entry): entry is PerforceFileEntry =>
          entry !== null && !openedPaths.has(entry.path.toLocaleLowerCase())
      )
    return {
      entries: [...opened, ...unopened],
      ...(info.client ? { client: info.client } : {}),
      ...(info.stream ? { stream: info.stream } : {}),
      ...(info.user ? { user: info.user } : {})
    }
  }

  async changelists(
    worktreePath: string,
    options: { includeUnopened?: boolean } = {}
  ): Promise<PerforceChangelistsResult> {
    const info = await this.info(worktreePath)
    if (!info.available || !info.isWorkspace || !info.client || !info.user) {
      throw new Error(info.error || 'Not a valid Perforce client workspace')
    }
    return listPerforceChangelists(
      this.run,
      worktreePath,
      info,
      await this.status(worktreePath, options, info)
    )
  }

  async createPendingChangelist(
    worktreePath: string,
    description: string
  ): Promise<PerforceMutationResult> {
    return createPendingPerforceChangelist(this.run, worktreePath, description)
  }

  async moveFiles(worktreePath: string, changelist: string, filePaths: string[]): Promise<void> {
    await movePerforceFiles(this.run, worktreePath, changelist, filePaths)
  }

  async shelvedFiles(worktreePath: string, changelist: string): Promise<PerforceShelvedFile[]> {
    return loadPerforceShelvedFiles(this.run, worktreePath, changelist)
  }

  async shelvedDiff(worktreePath: string, changelist: string, depotPath: string): Promise<string> {
    return loadPerforceShelvedDiff(this.run, worktreePath, changelist, depotPath)
  }

  async shelvedFileContent(worktreePath: string, changelist: string, file: PerforceShelvedFile) {
    return loadPerforceShelvedFileContent(this.run, worktreePath, changelist, file)
  }

  async diff(worktreePath: string, filePath: string): Promise<string> {
    const target = requirePerforceWorkspacePath(worktreePath, filePath)
    return runPerforceChecked(this.run, worktreePath, ['diff', '-du', '-f', target])
  }

  async open(worktreePath: string, filePath: string): Promise<void> {
    const target = requirePerforceWorkspacePath(worktreePath, filePath)
    const preview = await runPerforceChecked(this.run, worktreePath, [
      '-ztag',
      'reconcile',
      '-n',
      '-e',
      '-a',
      '-d',
      target
    ])
    const action = parseP4TaggedOutput(preview)[0]?.action ?? 'edit'
    const command = action.includes('add') ? 'add' : action.includes('delete') ? 'delete' : 'edit'
    await runPerforceChecked(this.run, worktreePath, [command, target])
  }

  async revert(worktreePath: string, filePath: string): Promise<void> {
    await runPerforceChecked(this.run, worktreePath, [
      'revert',
      '-k',
      requirePerforceWorkspacePath(worktreePath, filePath)
    ])
  }

  async submit(worktreePath: string, message: string): Promise<PerforceMutationResult> {
    let changelist: string | undefined
    try {
      const targets = await this.defaultChangelistTargets(worktreePath)
      changelist = await this.createChangelist(worktreePath, message)
      await runPerforceChecked(this.run, worktreePath, ['reopen', '-c', changelist, ...targets])
      await runPerforceChecked(this.run, worktreePath, ['submit', '-c', changelist])
      return { success: true, changelist }
    } catch (error) {
      return {
        success: false,
        ...(changelist ? { changelist } : {}),
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async shelve(worktreePath: string, message: string): Promise<PerforceMutationResult> {
    let changelist: string | undefined
    try {
      const targets = await this.defaultChangelistTargets(worktreePath)
      changelist = await this.createChangelist(worktreePath, message)
      await runPerforceChecked(this.run, worktreePath, ['reopen', '-c', changelist, ...targets])
      await runPerforceChecked(this.run, worktreePath, ['shelve', '-c', changelist])
      return { success: true, changelist }
    } catch (error) {
      return {
        success: false,
        ...(changelist ? { changelist } : {}),
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async sync(worktreePath: string): Promise<void> {
    await runPerforceChecked(this.run, worktreePath, ['sync'], { timeoutMs: P4_SYNC_TIMEOUT_MS })
  }

  private async defaultChangelistTargets(worktreePath: string): Promise<string[]> {
    const openedResult = await this.run(['-ztag', 'opened', '...'], { cwd: worktreePath })
    const records = parseP4TaggedOutput(optionalPerforceStatusOutput(openedResult)).filter(
      (record) => {
        const clientFile = record.clientFile
        return clientFile && isPathInsideOrEqual(worktreePath, clientFile)
      }
    )
    if (records.some((record) => record.change && record.change !== 'default')) {
      throw new Error(
        'Some project files are already in numbered changelists. Submit or shelve those changelists separately.'
      )
    }
    const targets = records
      .map((record) => record.clientFile)
      .filter((clientFile): clientFile is string => Boolean(clientFile))
    if (targets.length === 0) {
      throw new Error('No files are open in the default changelist for this project')
    }
    return targets
  }

  private async createChangelist(worktreePath: string, message: string): Promise<string> {
    return createPerforceChangelist(this.run, worktreePath, message)
  }
}
