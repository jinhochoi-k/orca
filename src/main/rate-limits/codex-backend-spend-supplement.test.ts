import { describe, expect, it, vi } from 'vitest'
import type { ProviderRateLimits } from '../../shared/rate-limit-types'
import type * as CodexBackendAuth from './codex-backend-auth'
import { supplementCodexSessionWindow } from './codex-backend-usage-client'

vi.mock('./codex-backend-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof CodexBackendAuth>()),
  getCodexBackendAuthHeaders: vi.fn(async () => ({ Authorization: 'Bearer token' }))
}))

const windowlessRpcLimits: ProviderRateLimits = {
  provider: 'codex',
  session: null,
  weekly: null,
  updatedAt: 1,
  error: null,
  status: 'ok'
}

function backendResponding(payload: unknown) {
  return vi.fn(async () => ({ ok: true, json: async () => payload }) as Response)
}

describe('supplementCodexSessionWindow with a spend-controlled plan', () => {
  it('probes the backend and adopts the spend bucket when RPC reports no windows', async () => {
    const request = backendResponding({
      plan_type: 'business',
      rate_limit: null,
      spend_control: {
        individual_limit: { limit: '6250', used: '569', used_percent: 9.1, reset_at: 1_800_000_000 }
      }
    })

    const result = await supplementCodexSessionWindow(windowlessRpcLimits, request)

    expect(request).toHaveBeenCalledOnce()
    expect(result.buckets).toEqual([expect.objectContaining({ name: '569 / 6250 cr' })])
    expect(result.planType).toBe('business')
  })

  it('leaves an account that already has a session window alone', async () => {
    const request = backendResponding({ plan_type: 'plus' })

    const result = await supplementCodexSessionWindow(
      {
        ...windowlessRpcLimits,
        session: { usedPercent: 10, windowMinutes: 300, resetsAt: null, resetDescription: null }
      },
      request
    )

    expect(request).not.toHaveBeenCalled()
    expect(result.buckets).toBeUndefined()
  })

  it('keeps the RPC result when the backend reports neither windows nor spend', async () => {
    const request = backendResponding({ plan_type: 'plus', rate_limit: null })

    await expect(supplementCodexSessionWindow(windowlessRpcLimits, request)).resolves.toBe(
      windowlessRpcLimits
    )
  })
})
