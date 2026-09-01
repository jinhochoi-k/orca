import { useState } from 'react'
import { ChevronDown, FileInput, Layers3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type {
  PerforceChangelist,
  PerforceFileEntry,
  PerforceShelvedFile
} from '../../../../../shared/perforce-types'

function statusLabel(status: PerforceFileEntry['status']): string {
  return status === 'added' ? 'A' : status === 'deleted' ? 'D' : status === 'renamed' ? 'R' : 'M'
}

function PerforceFileRow({
  entry,
  changelists,
  currentChangelist,
  busy,
  onDiff,
  onMove
}: {
  entry: PerforceFileEntry
  changelists: PerforceChangelist[]
  currentChangelist?: string
  busy: boolean
  onDiff: () => void
  onMove: (changelist: string) => void
}) {
  return (
    <div className="group flex min-h-8 items-center gap-2 border-b border-border/40 px-2 text-xs hover:bg-accent">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={onDiff}
      >
        <span className="w-4 shrink-0 text-center font-mono font-semibold text-muted-foreground">
          {busy ? <Loader2 className="size-3 animate-spin" /> : statusLabel(entry.status)}
        </span>
        <span className="truncate font-mono" title={entry.path}>
          {entry.path}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" disabled={busy} aria-label={`Move ${entry.path}`}>
            <FileInput className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="w-56">
          <DropdownMenuLabel>Move to changelist</DropdownMenuLabel>
          {changelists
            .filter((change) => change.id !== currentChangelist)
            .map((change) => (
              <DropdownMenuItem key={change.id} onSelect={() => onMove(change.id)}>
                <span className="truncate">
                  {change.id === 'default' ? 'Default' : `CL ${change.id}`}
                </span>
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function PerforceChangelistSection({
  changelist,
  changelists,
  shelvedFiles,
  shelvedLoading,
  busyPath,
  onDiff,
  onMove,
  onLoadShelved,
  onShelvedDiff
}: {
  changelist: PerforceChangelist
  changelists: PerforceChangelist[]
  shelvedFiles?: PerforceShelvedFile[]
  shelvedLoading: boolean
  busyPath: string | null
  onDiff: (entry: PerforceFileEntry) => void
  onMove: (entry: PerforceFileEntry, changelist: string) => void
  onLoadShelved: () => void
  onShelvedDiff: (entry: PerforceShelvedFile) => void
}) {
  const [open, setOpen] = useState(changelist.files.length > 0 || changelist.id === 'default')
  const [shelvedOpen, setShelvedOpen] = useState(true)
  const title = changelist.id === 'default' ? 'Default changelist' : `CL ${changelist.id}`

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-left hover:bg-accent">
        <ChevronDown
          className={cn('size-3.5 shrink-0 transition-transform', !open && '-rotate-90')}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{title}</span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {changelist.description || 'No description'}
          </span>
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {changelist.files.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {changelist.files.map((entry) => (
          <PerforceFileRow
            key={entry.path}
            entry={entry}
            changelists={changelists}
            currentChangelist={changelist.id}
            busy={busyPath === entry.path}
            onDiff={() => onDiff(entry)}
            onMove={(target) => onMove(entry, target)}
          />
        ))}
        {changelist.files.length === 0 ? (
          <p className="border-b border-border/40 px-8 py-2 text-[11px] text-muted-foreground">
            No open files
          </p>
        ) : null}
        {changelist.id !== 'default' ? (
          <div className="border-b border-border/40">
            {shelvedFiles === undefined ? (
              <Button
                variant="ghost"
                size="xs"
                className="m-1.5"
                disabled={shelvedLoading}
                onClick={onLoadShelved}
              >
                {shelvedLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Layers3 className="size-3.5" />
                )}
                View shelved files
              </Button>
            ) : (
              <Collapsible open={shelvedOpen} onOpenChange={setShelvedOpen}>
                <CollapsibleTrigger className="flex h-7 w-full items-center gap-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent">
                  <ChevronDown
                    className={cn(
                      'size-3 shrink-0 transition-transform',
                      !shelvedOpen && '-rotate-90'
                    )}
                  />
                  <span className="flex-1">Shelved files</span>
                  <span className="tabular-nums">{shelvedFiles.length}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {shelvedFiles.length === 0 ? (
                    <p className="border-t border-border/40 px-8 py-2 text-[11px] text-muted-foreground">
                      No shelved files
                    </p>
                  ) : (
                    shelvedFiles.map((entry) => (
                      <button
                        key={entry.depotPath}
                        type="button"
                        className="flex min-h-8 w-full items-center gap-2 border-t border-border/40 px-3 text-left text-xs hover:bg-accent"
                        onClick={() => onShelvedDiff(entry)}
                      >
                        <span className="w-4 font-mono font-semibold text-muted-foreground">
                          {statusLabel(entry.status)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono" title={entry.depotPath}>
                          {entry.depotPath}
                        </span>
                      </button>
                    ))
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function PerforceLocalChanges({
  entries,
  changelists,
  busyPath,
  onDiff,
  onMove
}: {
  entries: PerforceFileEntry[]
  changelists: PerforceChangelist[]
  busyPath: string | null
  onDiff: (entry: PerforceFileEntry) => void
  onMove: (entry: PerforceFileEntry, changelist: string) => void
}) {
  if (entries.length === 0) {
    return null
  }
  return (
    <section>
      <div className="flex h-7 items-center border-b border-border/60 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Local changes <span className="ml-auto tabular-nums">{entries.length}</span>
      </div>
      {entries.map((entry) => (
        <PerforceFileRow
          key={entry.path}
          entry={entry}
          changelists={changelists}
          busy={busyPath === entry.path}
          onDiff={() => onDiff(entry)}
          onMove={(target) => onMove(entry, target)}
        />
      ))}
    </section>
  )
}
