import { describe, expect, it } from 'vitest'
import type { Repo } from '../../shared/repo-types'
import { getPerforceSubmitPolicy } from './submit-policy'

function repo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'p4',
    path: 'C:\\work',
    displayName: 'Perforce',
    badgeColor: '#000000',
    addedAt: 1,
    kind: 'perforce',
    ...overrides
  }
}

describe('getPerforceSubmitPolicy', () => {
  it('allows submit by default for a registered Perforce project', () => {
    expect(getPerforceSubmitPolicy([repo()], 'c:\\WORK')).toEqual({ allowed: true })
  })

  it('blocks submit when the project option is enabled', () => {
    expect(getPerforceSubmitPolicy([repo({ perforceSubmitDisabled: true })], 'C:\\work')).toEqual({
      allowed: false,
      error: 'Perforce submit is disabled for this project'
    })
  })

  it('blocks unregistered paths', () => {
    expect(getPerforceSubmitPolicy([repo()], 'C:\\other')).toMatchObject({ allowed: false })
  })
})
