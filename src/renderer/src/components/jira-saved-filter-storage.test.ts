// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  loadJiraSavedFilters,
  normalizeJiraSavedFilters,
  saveJiraSavedFilters
} from './jira-saved-filter-storage'

const STORAGE_KEY = 'orca.jira.saved-filters.v1'

describe('Jira saved filter storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips saved filters', () => {
    const filters = [
      { id: 'mine', name: 'My bugs', jql: 'assignee = currentUser() AND labels = bug' }
    ]

    expect(saveJiraSavedFilters(filters)).toEqual(filters)
    expect(loadJiraSavedFilters()).toEqual(filters)
  })

  it('drops invalid and duplicate entries without losing valid filters', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'valid', name: '  Active sprint  ', jql: '  sprint in openSprints()  ' },
        { id: 'valid', name: 'Duplicate', jql: 'project = DUP' },
        { id: 'missing-jql', name: 'Broken' },
        null
      ])
    )

    expect(loadJiraSavedFilters()).toEqual([
      { id: 'valid', name: 'Active sprint', jql: 'sprint in openSprints()' }
    ])
  })

  it('returns an empty list for corrupt storage', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')

    expect(loadJiraSavedFilters()).toEqual([])
  })

  it('bounds persisted entries', () => {
    const filters = Array.from({ length: 60 }, (_, index) => ({
      id: `filter-${index}`,
      name: `Filter ${index}`,
      jql: `project = PROJECT${index}`
    }))

    expect(normalizeJiraSavedFilters(filters)).toHaveLength(50)
  })

  it('removes storage when the final filter is deleted', () => {
    saveJiraSavedFilters([{ id: 'one', name: 'One', jql: 'project = ONE' }])

    saveJiraSavedFilters([])

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
