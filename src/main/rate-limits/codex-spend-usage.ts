import type { RateLimitBucket } from '../../shared/rate-limit-types'
import { mapCodexRateLimitWindow } from './codex-rate-limit-window-mapper'

/** Workspace spend control reported by `wham/usage`. ChatGPT Business seats are
 *  billed against a credit budget instead of rate-limit windows, so they return
 *  `rate_limit: null` and carry their real figures here. */
export type CodexSpendControl = {
  individual_limit?: {
    source?: string
    limit?: string | number
    used?: string | number
    used_percent?: number
    reset_at?: number
  } | null
} | null

/** The credit budget renews on a billing cycle; 43200 minutes is the duration
 *  the panel already labels "30d". */
const CODEX_SPEND_WINDOW_MINUTES = 43_200

function creditCount(value: string | number | undefined): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

/** Maps the workspace credit budget to a labelled bucket so the usage panel can
 *  draw a bar for plans that report no rate-limit windows. Returns null once the
 *  backend reports windows normally, keeping Plus/Pro panels untouched.
 *
 *  The figures stay in raw credits: the credit-to-dollar ratio moves with
 *  OpenAI's promotions, so any conversion here would go stale silently. */
export function mapCodexSpendBucket(
  spendControl: CodexSpendControl,
  hasRateLimitWindow: boolean
): RateLimitBucket | null {
  if (hasRateLimitWindow) {
    return null
  }
  const limit = spendControl?.individual_limit
  const usedCredits = creditCount(limit?.used)
  const limitCredits = creditCount(limit?.limit)
  if (usedCredits === null || limitCredits === null || limitCredits <= 0) {
    return null
  }
  const window = mapCodexRateLimitWindow(
    { usedPercent: limit?.used_percent, resetsAt: limit?.reset_at },
    CODEX_SPEND_WINDOW_MINUTES
  )
  if (!window) {
    return null
  }
  return { ...window, name: `${Math.round(usedCredits)} / ${Math.round(limitCredits)} cr` }
}
