export type PerforceDiffLineKind = 'add' | 'context' | 'file' | 'hunk' | 'meta' | 'remove'

export type PerforceDiffLine = {
  content: string
  id: number
  kind: PerforceDiffLineKind
  oldLine?: number
  newLine?: number
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

export function parsePerforceUnifiedDiff(content: string): PerforceDiffLine[] {
  let oldLine: number | undefined
  let newLine: number | undefined

  return content.split(/\r?\n/).map((line, id) => {
    const hunk = HUNK_HEADER.exec(line)
    if (hunk) {
      oldLine = Number(hunk[1])
      newLine = Number(hunk[2])
      return { content: line, id, kind: 'hunk' }
    }
    if (line.startsWith('====')) {
      return { content: line, id, kind: 'file' }
    }
    if (line.startsWith('\\') || oldLine === undefined || newLine === undefined) {
      return { content: line, id, kind: 'meta' }
    }
    if (line.startsWith('+')) {
      const parsed = { content: line, id, kind: 'add' as const, newLine }
      newLine += 1
      return parsed
    }
    if (line.startsWith('-')) {
      const parsed = { content: line, id, kind: 'remove' as const, oldLine }
      oldLine += 1
      return parsed
    }
    const parsed = { content: line, id, kind: 'context' as const, oldLine, newLine }
    oldLine += 1
    newLine += 1
    return parsed
  })
}

export function countPerforceDiffChanges(lines: PerforceDiffLine[]): {
  additions: number
  deletions: number
} {
  return lines.reduce(
    (counts, line) => ({
      additions: counts.additions + (line.kind === 'add' ? 1 : 0),
      deletions: counts.deletions + (line.kind === 'remove' ? 1 : 0)
    }),
    { additions: 0, deletions: 0 }
  )
}
