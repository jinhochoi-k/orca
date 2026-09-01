import { describe, expect, it } from 'vitest'
import { countPerforceDiffChanges, parsePerforceUnifiedDiff } from './perforce-unified-diff'

describe('parsePerforceUnifiedDiff', () => {
  it('classifies unified diff lines and tracks both line numbers', () => {
    const lines = parsePerforceUnifiedDiff(
      [
        '==== //depot/File.cpp#3 ====',
        '@@ -10,3 +10,4 @@',
        ' context',
        '-old',
        '+new',
        '+extra'
      ].join('\n')
    )

    expect(lines).toMatchObject([
      { kind: 'file' },
      { kind: 'hunk' },
      { kind: 'context', oldLine: 10, newLine: 10 },
      { kind: 'remove', oldLine: 11 },
      { kind: 'add', newLine: 11 },
      { kind: 'add', newLine: 12 }
    ])
    expect(countPerforceDiffChanges(lines)).toEqual({ additions: 2, deletions: 1 })
  })
})
