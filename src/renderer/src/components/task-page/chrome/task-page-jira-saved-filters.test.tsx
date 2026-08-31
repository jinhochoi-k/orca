// @vitest-environment happy-dom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { saveJiraSavedFilters } from './jira-saved-filter-storage'
import { TaskPageJiraSavedFilters } from './task-page-jira-saved-filters'

function renderFilters(props: React.ComponentProps<typeof TaskPageJiraSavedFilters>): void {
  render(
    <TooltipProvider>
      <TaskPageJiraSavedFilters {...props} />
    </TooltipProvider>
  )
}

describe('TaskPageJiraSavedFilters', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('saves and applies a named JQL filter', () => {
    const applyJql = vi.fn()
    renderFilters({ jiraSearchInput: 'project = ORCA', appliedJiraSearch: '', applyJql })

    fireEvent.click(screen.getByRole('button', { name: 'Add saved Jira filter' }))
    fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'Orca work' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }))

    expect(applyJql).toHaveBeenCalledWith('project = ORCA')
    expect(screen.getByRole('button', { name: 'Orca work' })).toBeTruthy()
  })

  it('restores saved filters and applies one from its chip', () => {
    saveJiraSavedFilters([{ id: 'bugs', name: 'My bugs', jql: 'labels = bug' }])
    const applyJql = vi.fn()
    renderFilters({ jiraSearchInput: '', appliedJiraSearch: '', applyJql })

    fireEvent.click(screen.getByRole('button', { name: 'My bugs' }))

    expect(applyJql).toHaveBeenCalledWith('labels = bug')
  })

  it('deletes a saved filter without clearing the applied JQL', () => {
    saveJiraSavedFilters([{ id: 'bugs', name: 'My bugs', jql: 'labels = bug' }])
    const applyJql = vi.fn()
    renderFilters({
      jiraSearchInput: 'labels = bug',
      appliedJiraSearch: 'labels = bug',
      applyJql
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Jira filter My bugs' }))

    expect(screen.queryByRole('button', { name: 'My bugs' })).toBeNull()
    expect(applyJql).not.toHaveBeenCalled()
  })

  it('prevents duplicate names', () => {
    saveJiraSavedFilters([{ id: 'bugs', name: 'My bugs', jql: 'labels = bug' }])
    renderFilters({ jiraSearchInput: 'project = ORCA', appliedJiraSearch: '', applyJql: vi.fn() })

    fireEvent.click(screen.getByRole('button', { name: 'Add saved Jira filter' }))
    fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'my BUGS' } })

    expect(screen.getByText('A filter with this name already exists.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save filter' }).hasAttribute('disabled')).toBe(true)
  })
})
