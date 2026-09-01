import { isAbsolute, relative, resolve } from 'node:path'
import type { PerforceFileEntry } from '../../shared/perforce-types'

export type TaggedRecord = Record<string, string>

export type PerforceRun = (
  args: readonly string[],
  options: { cwd: string; input?: string; timeoutMs?: number }
) => Promise<{ code: number | null; stdout: string; stderr: string }>

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

export function perforceErrorText(result: { stderr: string; stdout: string }): string {
  return (result.stderr || result.stdout || 'Perforce command failed').trim()
}

export function optionalPerforceStatusOutput(result: {
  code: number | null
  stdout: string
  stderr: string
}): string {
  if (result.code === 0) {
    return result.stdout
  }
  const message = perforceErrorText(result)
  if (/file\(s\) not opened|no file\(s\) to reconcile|no files to reconcile/i.test(message)) {
    return ''
  }
  throw new Error(message)
}

export function mapPerforceAction(action: string): Pick<PerforceFileEntry, 'status' | 'area'> {
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

export function requirePerforceWorkspacePath(root: string, filePath: string): string {
  const absolute = isAbsolute(filePath) ? resolve(filePath) : resolve(root, filePath)
  const child = relative(resolve(root), absolute)
  if (child === '..' || child.startsWith(`..\\`) || child.startsWith('../') || isAbsolute(child)) {
    throw new Error('Perforce file path is outside the workspace root')
  }
  return absolute
}

export function isPathInsideOrEqual(root: string, candidate: string): boolean {
  const child = relative(resolve(root), resolve(candidate))
  return child === '' || (!child.startsWith('..') && !isAbsolute(child))
}

export async function runPerforceChecked(
  run: PerforceRun,
  cwd: string,
  args: readonly string[],
  options: { input?: string; timeoutMs?: number } = {}
): Promise<string> {
  const result = await run(args, { cwd, ...options })
  if (result.code !== 0) {
    throw new Error(perforceErrorText(result))
  }
  return result.stdout
}
