import { describe, expect, it } from 'vitest'
import { mapClaudeSpendBucket } from './claude-spend-usage'

describe('mapClaudeSpendBucket', () => {
  it('maps an Enterprise seat with no rate-limit windows', () => {
    const bucket = mapClaudeSpendBucket(
      {
        extra_usage: {
          is_enabled: true,
          monthly_limit: 25_000,
          used_credits: 569,
          utilization: 2.276
        }
      },
      false
    )
    expect(bucket).toEqual({
      name: '$5.69 / $250',
      usedPercent: 2.276,
      windowMinutes: 43_200,
      resetsAt: null,
      resetDescription: null
    })
  })

  it('falls back to the spend block when extra_usage is absent', () => {
    expect(
      mapClaudeSpendBucket(
        {
          spend: {
            enabled: true,
            percent: 40,
            used: { amount_minor: 10_000 },
            limit: { amount_minor: 25_000 }
          }
        },
        false
      )
    ).toMatchObject({ name: '$100 / $250', usedPercent: 40 })
  })

  it('stays out of the way when the account reports rate-limit windows', () => {
    expect(
      mapClaudeSpendBucket(
        {
          extra_usage: {
            monthly_limit: 25_000,
            used_credits: 1,
            utilization: 1
          }
        },
        true
      )
    ).toBeNull()
  })

  it('returns null when the payload carries no spend figures', () => {
    expect(mapClaudeSpendBucket({}, false)).toBeNull()
    expect(mapClaudeSpendBucket({ extra_usage: { utilization: 2 } }, false)).toBeNull()
    expect(
      mapClaudeSpendBucket(
        { extra_usage: { utilization: 2, used_credits: 1, monthly_limit: 0 } },
        false
      )
    ).toBeNull()
  })

  it('clamps the reported utilization into the bar range', () => {
    expect(
      mapClaudeSpendBucket(
        {
          extra_usage: {
            utilization: 140,
            used_credits: 35_000,
            monthly_limit: 25_000
          }
        },
        false
      )
    ).toMatchObject({ usedPercent: 100 })
  })
})
