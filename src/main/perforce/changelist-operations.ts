import type {
  PerforceChangelist,
  PerforceChangelistsResult,
  PerforceInfoResult,
  PerforceMutationResult,
  PerforceShelvedFile,
  PerforceShelvedFileContent,
  PerforceStatusResult
} from '../../shared/perforce-types'
import {
  mapPerforceAction,
  parseP4TaggedOutput,
  requirePerforceWorkspacePath,
  runPerforceChecked,
  type PerforceRun
} from './command'

function sanitizeChangelistId(changelist: string): string {
  if (changelist === 'default' || /^\d+$/.test(changelist)) {
    return changelist
  }
  throw new Error('Invalid Perforce changelist')
}

function sanitizeDepotPath(depotPath: string): string {
  if (depotPath.startsWith('//') && !/[\r\n@#]/.test(depotPath)) {
    return depotPath
  }
  throw new Error('Invalid shelved Perforce file')
}

function parseShelvedFileRecords(output: string): Record<string, string>[] {
  const record = parseP4TaggedOutput(output)[0] ?? {}
  const files: { index: string; depotPath: string }[] = []
  for (const [key, depotPath] of Object.entries(record)) {
    const index = /^depotFile(\d+)$/.exec(key)?.[1]
    if (index) {
      files.push({ index, depotPath })
    }
  }
  return files.map(({ index, depotPath }) => ({
    depotFile: depotPath,
    action: record[`action${index}`] ?? '',
    rev: record[`rev${index}`] ?? ''
  }))
}

export function extractShelvedFileDiff(output: string, depotPath: string): string {
  const lines = output.split(/\r?\n/)
  const start = lines.findIndex((line) => line.startsWith('====') && line.includes(depotPath))
  if (start === -1) {
    return ''
  }
  const next = lines.findIndex(
    (line, index) => index > start && line.startsWith('====') && !line.includes(depotPath)
  )
  return lines
    .slice(start, next === -1 ? undefined : next)
    .join('\n')
    .trim()
}

export async function listPerforceChangelists(
  run: PerforceRun,
  worktreePath: string,
  info: PerforceInfoResult,
  status: PerforceStatusResult
): Promise<PerforceChangelistsResult> {
  if (!info.client || !info.user) {
    throw new Error('Perforce client or user is unavailable')
  }
  const output = await runPerforceChecked(run, worktreePath, [
    '-ztag',
    'changes',
    '-m',
    '100',
    '-s',
    'pending',
    '-c',
    info.client,
    '-u',
    info.user,
    '-l'
  ])
  const byChange = new Map<string, typeof status.entries>()
  for (const entry of status.entries.filter((candidate) => candidate.area === 'staged')) {
    const id = entry.changelist || 'default'
    byChange.set(id, [...(byChange.get(id) ?? []), entry])
  }
  const numbered = parseP4TaggedOutput(output).map<PerforceChangelist>((record) => ({
    id: record.change,
    description: (record.desc || '').trim(),
    files: byChange.get(record.change) ?? [],
    ...(record.user ? { user: record.user } : {}),
    ...(record.client ? { client: record.client } : {}),
    ...(record.time && Number.isFinite(Number(record.time))
      ? { modifiedAt: Number(record.time) * 1000 }
      : {})
  }))
  return {
    changelists: [
      {
        id: 'default',
        description: 'Default changelist',
        files: byChange.get('default') ?? [],
        user: info.user,
        client: info.client
      },
      ...numbered
    ],
    localChanges: status.entries.filter((entry) => entry.area !== 'staged'),
    client: info.client,
    ...(info.stream ? { stream: info.stream } : {}),
    user: info.user
  }
}

export async function createPerforceChangelist(
  run: PerforceRun,
  worktreePath: string,
  description: string
): Promise<string> {
  const spec = `Change: new\n\nDescription:\n\t${description.trim().replaceAll('\n', '\n\t')}\n`
  const created = await runPerforceChecked(run, worktreePath, ['change', '-i'], { input: spec })
  const changelist = /Change\s+(\d+)\s+created/i.exec(created)?.[1]
  if (!changelist) {
    throw new Error(`Could not read created changelist from: ${created.trim()}`)
  }
  return changelist
}

export async function createPendingPerforceChangelist(
  run: PerforceRun,
  worktreePath: string,
  description: string
): Promise<PerforceMutationResult> {
  try {
    return {
      success: true,
      changelist: await createPerforceChangelist(run, worktreePath, description)
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function movePerforceFiles(
  run: PerforceRun,
  worktreePath: string,
  changelist: string,
  filePaths: string[]
): Promise<void> {
  const id = sanitizeChangelistId(changelist)
  const targets = filePaths.map((filePath) => requirePerforceWorkspacePath(worktreePath, filePath))
  if (targets.length === 0) {
    throw new Error('Select at least one Perforce file')
  }
  await runPerforceChecked(run, worktreePath, ['reopen', '-c', id, ...targets])
}

export async function loadPerforceShelvedFiles(
  run: PerforceRun,
  worktreePath: string,
  changelist: string
): Promise<PerforceShelvedFile[]> {
  const id = sanitizeChangelistId(changelist)
  if (id === 'default') {
    return []
  }
  const output = await runPerforceChecked(run, worktreePath, ['-ztag', 'describe', '-S', '-s', id])
  return parseShelvedFileRecords(output).map((record) => ({
    depotPath: record.depotFile,
    status: mapPerforceAction(record.action || '').status,
    ...(record.rev ? { revision: record.rev } : {})
  }))
}

export async function loadPerforceShelvedDiff(
  run: PerforceRun,
  worktreePath: string,
  changelist: string,
  depotPath: string
): Promise<string> {
  const id = sanitizeChangelistId(changelist)
  if (id === 'default' || !depotPath.startsWith('//')) {
    throw new Error('Invalid shelved Perforce file')
  }
  const output = await runPerforceChecked(run, worktreePath, ['describe', '-du', '-S', id])
  return extractShelvedFileDiff(output, depotPath)
}

export async function loadPerforceShelvedFileContent(
  run: PerforceRun,
  worktreePath: string,
  changelist: string,
  file: PerforceShelvedFile
): Promise<PerforceShelvedFileContent> {
  const id = sanitizeChangelistId(changelist)
  const depotPath = sanitizeDepotPath(file.depotPath)
  if (id === 'default') {
    throw new Error('Invalid shelved Perforce file')
  }
  const revision = file.revision && /^\d+$/.test(file.revision) ? file.revision : null
  if (file.status !== 'added' && revision === null) {
    throw new Error('Shelved file base revision is unavailable')
  }
  const [originalContent, modifiedContent] = await Promise.all([
    file.status === 'added'
      ? Promise.resolve('')
      : runPerforceChecked(run, worktreePath, ['print', '-q', `${depotPath}#${revision}`]),
    file.status === 'deleted'
      ? Promise.resolve('')
      : runPerforceChecked(run, worktreePath, ['print', '-q', `${depotPath}@=${id}`])
  ])
  return { originalContent, modifiedContent }
}
