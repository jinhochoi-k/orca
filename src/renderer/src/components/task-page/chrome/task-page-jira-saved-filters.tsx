import React from 'react'
import { BookmarkPlus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  loadJiraSavedFilters,
  saveJiraSavedFilters,
  type JiraSavedFilter
} from './jira-saved-filter-storage'

type TaskPageJiraSavedFiltersProps = {
  jiraSearchInput: string
  appliedJiraSearch: string
  applyJql: (jql: string) => void
}

function createFilterId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function TaskPageJiraSavedFilters({
  jiraSearchInput,
  appliedJiraSearch,
  applyJql
}: TaskPageJiraSavedFiltersProps): React.JSX.Element {
  const [filters, setFilters] = React.useState<JiraSavedFilter[]>(loadJiraSavedFilters)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [jql, setJql] = React.useState('')
  const trimmedName = name.trim()
  const trimmedJql = jql.trim()
  const duplicateName = filters.some(
    (filter) => filter.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase()
  )

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen)
    if (nextOpen) {
      setName('')
      setJql(jiraSearchInput.trim() || appliedJiraSearch.trim())
    }
  }

  const handleSave = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!trimmedName || !trimmedJql || duplicateName) {
      return
    }
    const filter = { id: createFilterId(), name: trimmedName, jql: trimmedJql }
    setFilters((current) => saveJiraSavedFilters([...current, filter]))
    applyJql(filter.jql)
    setOpen(false)
  }

  const deleteFilter = (id: string): void => {
    setFilters((current) => saveJiraSavedFilters(current.filter((filter) => filter.id !== id)))
  }

  return (
    <>
      {filters.map((filter) => {
        const active = appliedJiraSearch.trim() === filter.jql
        return (
          <ButtonGroup key={filter.id}>
            <button
              type="button"
              onClick={() => applyJql(filter.jql)}
              className={cn(
                'rounded-md border border-border/50 px-2 py-1 text-xs transition',
                active
                  ? 'bg-foreground/90 text-background backdrop-blur-md'
                  : 'bg-transparent text-foreground hover:bg-muted/50'
              )}
            >
              {filter.name}
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={translate(
                    'auto.components.TaskPage.a3dcb2738f',
                    'Delete Jira filter {{value0}}',
                    { value0: filter.name }
                  )}
                  onClick={() => deleteFilter(filter.id)}
                  className={cn(
                    'rounded-md border border-border/50 px-1.5 text-muted-foreground transition hover:bg-muted/50 hover:text-destructive',
                    active && 'bg-foreground/90 text-background hover:bg-foreground/80'
                  )}
                >
                  <X className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {translate('auto.components.TaskPage.080614fb55', 'Delete saved filter')}
              </TooltipContent>
            </Tooltip>
          </ButtonGroup>
        )
      })}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon-xs"
                aria-label={translate(
                  'auto.components.TaskPage.63294cc14f',
                  'Add saved Jira filter'
                )}
                className="border-border/50 bg-transparent hover:bg-muted/50"
              >
                <BookmarkPlus />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate('auto.components.TaskPage.63294cc14f', 'Add saved Jira filter')}
          </TooltipContent>
        </Tooltip>
        <PopoverContent align="start" side="bottom" sideOffset={6} className="w-80 p-3">
          <form className="space-y-3" onSubmit={handleSave}>
            <div className="space-y-1">
              <Label htmlFor="jira-saved-filter-name">
                {translate('auto.components.TaskPage.d9de27add5', 'Filter name')}
              </Label>
              <Input
                id="jira-saved-filter-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                autoFocus
                aria-invalid={duplicateName || undefined}
                placeholder={translate('auto.components.TaskPage.b9d2dc1923', 'My active bugs')}
              />
              {duplicateName ? (
                <p className="text-xs text-destructive">
                  {translate(
                    'auto.components.TaskPage.96059bb3b7',
                    'A filter with this name already exists.'
                  )}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="jira-saved-filter-jql">JQL</Label>
              <Textarea
                id="jira-saved-filter-jql"
                value={jql}
                onChange={(event) => setJql(event.target.value)}
                maxLength={4000}
                rows={4}
                placeholder="project = ABC AND statusCategory != Done"
                className="resize-y text-xs"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={!trimmedName || !trimmedJql || duplicateName}
              >
                {translate('auto.components.TaskPage.cb04d2af0e', 'Save filter')}
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </>
  )
}
