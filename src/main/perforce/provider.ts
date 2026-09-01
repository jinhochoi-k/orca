import { isAbsolute, relative, resolve } from 'node:path'
import { runProcess } from '../../shared/child-process/run-process'
import type {
  PerforceFileEntry,
  PerforceInfoResult,
  PerforceMutationResult,
  PerforceStatusResult
} from '../../shared/perforce-types'

const P4_TIMEOUT_MS = 30_000
const P4_STATUS_TIMEOUT_MS = 120_000
const P4_SYNC_TIMEOUT_MS = 10 * 60_000

type TaggedRecord = Record<string, string>
export type PerforceRun = (
  args: readonly string[],
  options: { cwd: string; input?: string; timeoutMs?: number }
) => Promise<{
  code: number | null
  stdout: string
  stderr: string
}>

const defaultRun: PerforceRun = async (args, options) =>
  runProcess({
    program: 'p4',
    args: [...args],
    cwd: options.cwd,
    input: options.input,
    timeoutMs: options.timeoutMs ?? P4_TIMEOUT_MS
  })

export function parseP4TaggedOutput(output: string): TaggedRecord[] {
  const records: TaggedRecord[] = []
  let current: TaggedRecord = {}
  for (const line of output.split(/\r?\n/)) {
    const match = /^\.\.\.\s+(\S+)\s?(.*)$/.exec(line)
    if (!match) {
      continue
    }
    const [, key, value] = match
    if (key in current) {
      records.push(current)
      current = {}
    }
    current[key] = value
  }
  if (Object.keys(current).length > 0) {
    records.push(current)
  }
  return records
}

function errorText(result: { stderr: string; stdout: string }): string {
  return (result.stderr || result.stdout || 'Perforce command failed').trim()
}

function optionalStatusOutput(result: {
  code: number | null
  stdout: string
  stderr: string
}): string {
  if (result.code === 0) {
    return result.stdout
  }
  const message = errorText(result)
  if (/file\(s\) not opened|no file\(s\) to reconcile|no files to reconcile/i.test(message)) {
    return ''
  }
  throw new Error(message)
}

function mapAction(action: string): Pick<PerforceFileEntry, 'status' | 'area'> {
  if (action.includes('add')) {
    return { status: 'added', area: 'staged' }
  }
  if (action.includes('delete')) {
    return { status: 'deleted', area: 'staged' }
  }
  if (action.includes('move')) {
    return { status: 'renamed', area: 'staged' }
  }
  return { status: 'modified', area: 'staged' }
}

function entryFromRecord(
  record: TaggedRecord,
  root: string,
  opened: boolean
): PerforceFileEntry | null {
  const clientFile = record.clientFile || record.path
  if (!clientFile || !isPathInsideOrEqual(root, clientFile)) {
    return null
  }
  const path = relative(root, clientFile).replaceAll('\\', '/')
  const mapped = mapAction(record.action || record.type || '')
  return {
    path,
    status: mapped.status,
    area: opened ? 'staged' : mapped.status === 'added' ? 'untracked' : 'unstaged',
    ...(record.change ? { changelist: record.change } : {}),
    ...(record.depotFile ? { depotPath: record.depotFile } : {})
  }
}

function requireWorkspacePath(root: string, filePath: string): string {
  const absolute = isAbsolute(filePath) ? resolve(filePath) : resolve(root, filePath)
  const child = relative(resolve(root), absolute)
  if (child === '..' || child.startsWith(`..\\`) || child.startsWith('../') || isAbsolute(child)) {
    throw new Error('Perforce file path is outside the workspace root')
  }
  return absolute
}

function isPathInsideOrEqual(root: string, candidate: string): boolean {
  const child = relative(resolve(root), resolve(candidate))
  return child === '' || (!child.startsWith('..') && !isAbsolute(child))
}

async function runChecked(
  run: PerforceRun,
  cwd: string,
  args: readonly string[],
  options: { input?: string; timeoutMs?: number } = {}
): Promise<string> {
  const result = await run(args, { cwd, ...options })
  if (result.code !== 0) {
    throw new Error(errorText(result))
  }
  return result.stdout
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
      return { available: true, isWorkspace: false, error: errorText(result) }
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
    options: { includeUnopened?: boolean } = {}
  ): Promise<PerforceStatusResult> {
    const info = await this.info(worktreePath)
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
    const openedOutput = optionalStatusOutput(openedResult)
    const reconcileOutput = optionalStatusOutput(reconcileResult)
    const opened = parseP4TaggedOutput(openedOutput)
      .map((record) => entryFromRecord(record, worktreePath, true))
      .filter((entry): entry is PerforceFileEntry => entry !== null)
    const openedPaths = new Set(opened.map((entry) => entry.path.toLocaleLowerCase()))
    const unopened = parseP4TaggedOutput(reconcileOutput)
      .map((record) => entryFromRecord(record, worktreePath, false))
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

  async diff(worktreePath: string, filePath: string): Promise<string> {
    const target = requireWorkspacePath(worktreePath, filePath)
    return runChecked(this.run, worktreePath, ['diff', '-du', '-f', target])
  }

  async open(worktreePath: string, filePath: string): Promise<void> {
    const target = requireWorkspacePath(worktreePath, filePath)
    const preview = await runChecked(this.run, worktreePath, [
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
    await runChecked(this.run, worktreePath, [command, target])
  }

  async revert(worktreePath: string, filePath: string): Promise<void> {
    await runChecked(this.run, worktreePath, [
      'revert',
      '-k',
      requireWorkspacePath(worktreePath, filePath)
    ])
  }

  async submit(worktreePath: string, message: string): Promise<PerforceMutationResult> {
    let changelist: string | undefined
    try {
      const targets = await this.defaultChangelistTargets(worktreePath)
      changelist = await this.createChangelist(worktreePath, message)
      await runChecked(this.run, worktreePath, ['reopen', '-c', changelist, ...targets])
      await runChecked(this.run, worktreePath, ['submit', '-c', changelist])
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
      await runChecked(this.run, worktreePath, ['reopen', '-c', changelist, ...targets])
      await runChecked(this.run, worktreePath, ['shelve', '-c', changelist])
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
    await runChecked(this.run, worktreePath, ['sync'], { timeoutMs: P4_SYNC_TIMEOUT_MS })
  }

  private async defaultChangelistTargets(worktreePath: string): Promise<string[]> {
    const openedResult = await this.run(['-ztag', 'opened', '...'], { cwd: worktreePath })
    const records = parseP4TaggedOutput(optionalStatusOutput(openedResult)).filter((record) => {
      const clientFile = record.clientFile
      return clientFile && isPathInsideOrEqual(worktreePath, clientFile)
    })
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
    const spec = `Change: new\n\nDescription:\n\t${message.trim().replaceAll('\n', '\n\t')}\n`
    const created = await runChecked(this.run, worktreePath, ['change', '-i'], { input: spec })
    const changelist = /Change\s+(\d+)\s+created/i.exec(created)?.[1]
    if (!changelist) {
      throw new Error(`Could not read created changelist from: ${created.trim()}`)
    }
    return changelist
  }
}
