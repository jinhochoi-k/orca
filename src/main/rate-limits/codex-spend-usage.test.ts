import { describe, expect, it } from 'vitest'
import { mapCodexSpendBucket } from './codex-spend-usage'

describe('mapCodexSpendBucket', () => {
  it('maps a Business workspace budget reported as strings', () => {
    expect(
      mapCodexSpendBucket(
        {
          individual_limit: {
            source: 'workspace_spend_controls',
            limit: '6250',
            used: '569',
            used_percent: 9.1,
            reset_at: 1_800_000_000
          }
        },
        false
      )
    ).toEqual({
      name: '569 / 6250 cr',
      usedPercent: 9.1,
      windowMinutes: 43_200,
      // Codex reports reset_at in seconds; the shared mapper converts to ms.
      resetsAt: 1_800_000_000_000,
      resetDescription: expect.any(String)
    })
  })

  it('stays out of the way when the backend reports rate-limit windows', () => {
    expect(
      mapCodexSpendBucket(
        { individual_limit: { limit: '6250', used: '569', used_percent: 9.1 } },
        true
      )
    ).toBeNull()
  })

  it('returns null without a usable budget', () => {
    expect(mapCodexSpendBucket(null, false)).toBeNull()
    expect(mapCodexSpendBucket({ individual_limit: null }, false)).toBeNull()
    expect(mapCodexSpendBucket({ individual_limit: { limit: '0', used: '5' } }, false)).toBeNull()
    // No used_percent means no bar to draw.
    expect(
      mapCodexSpendBucket({ individual_limit: { limit: '6250', used: '569' } }, false)
    ).toBeNull()
  })
})
