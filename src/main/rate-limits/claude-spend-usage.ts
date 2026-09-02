import type { RateLimitBucket } from '../../shared/rate-limit-types'

/** Spend/credit control reported by `/api/oauth/usage` for seats that are billed
 *  against a monthly budget instead of rate-limit windows. Enterprise seats
 *  (`rateLimitTier: default_claude_zero`) return `five_hour`/`seven_day` as null
 *  and carry their real figures here. */
export type ClaudeSpendUsageInput = {
  extra_usage?: {
    is_enabled?: boolean
    monthly_limit?: number
    used_credits?: number
    utilization?: number
  } | null
  spend?: {
    enabled?: boolean
    percent?: number
    used?: { amount_minor?: number } | null
    limit?: { amount_minor?: number } | null
  } | null
}

/** The budget is monthly; 43200 minutes is the duration the panel already
 *  labels "30d". */
const CLAUDE_SPEND_WINDOW_MINUTES = 43_200

// Both payloads report USD minor units (`currency: "USD"`, `decimal_places: 2`).
function formatMinorUsd(amountMinor: number): string {
  const amount = amountMinor / 100
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`
}

function finiteNumber(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Maps the monthly spend budget to a labelled bucket so the usage panel can
 *  draw a bar for seats that have no rate-limit windows at all. Returns null
 *  when the account reports windows normally (Pro/Max), keeping their panel
 *  untouched. */
export function mapClaudeSpendBucket(
  data: ClaudeSpendUsageInput,
  hasRateLimitWindow: boolean
): RateLimitBucket | null {
  if (hasRateLimitWindow) {
    return null
  }
  const usedMinor =
    finiteNumber(data.extra_usage?.used_credits) ?? finiteNumber(data.spend?.used?.amount_minor)
  const limitMinor =
    finiteNumber(data.extra_usage?.monthly_limit) ?? finiteNumber(data.spend?.limit?.amount_minor)
  const percent = finiteNumber(data.extra_usage?.utilization) ?? finiteNumber(data.spend?.percent)
  if (percent === null || usedMinor === null || limitMinor === null || limitMinor <= 0) {
    return null
  }
  return {
    name: `${formatMinorUsd(usedMinor)} / ${formatMinorUsd(limitMinor)}`,
    usedPercent: Math.min(100, Math.max(0, percent)),
    windowMinutes: CLAUDE_SPEND_WINDOW_MINUTES,
    resetsAt: null,
    resetDescription: null
  }
}
