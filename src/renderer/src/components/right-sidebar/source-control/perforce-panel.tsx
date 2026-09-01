import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Download, FilePlus2, Loader2, RefreshCw, ScanSearch, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { PerforceFileEntry, PerforceStatusResult } from '../../../../../shared/perforce-types'

const EMPTY_STATUS: PerforceStatusResult = { entries: [] }

function statusLabel(entry: PerforceFileEntry): string {
  return entry.status === 'added'
    ? 'A'
    : entry.status === 'deleted'
      ? 'D'
      : entry.status === 'renamed'
        ? 'R'
        : 'M'
}

export function PerforceSourceControlPanel({ worktreePath }: { worktreePath: string }) {
  const [status, setStatus] = useState<PerforceStatusResult>(EMPTY_STATUS)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mutation, setMutation] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [diff, setDiff] = useState<{ path: string; content: string } | null>(null)

  const refresh = useCallback(
    async (includeUnopened = false) => {
      setLoading(true)
      try {
        setStatus(await window.api.perforce.status({ worktreePath, includeUnopened }))
        setError(null)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught))
      } finally {
        setLoading(false)
      }
    },
    [worktreePath]
  )

  useEffect(() => {
    void refresh(false)
    const timer = window.setInterval(() => void refresh(false), 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const groups = useMemo(
    () => ({
      opened: status.entries.filter((entry) => entry.area === 'staged'),
      local: status.entries.filter((entry) => entry.area !== 'staged')
    }),
    [status.entries]
  )

  const mutate = useCallback(
    async (label: string, action: () => Promise<void>) => {
      setMutation(label)
      try {
        await action()
        await refresh()
      } catch (caught) {
        toast.error(`${label} failed`, {
          description: caught instanceof Error ? caught.message : String(caught)
        })
      } finally {
        setMutation(null)
      }
    },
    [refresh]
  )

  const openDiff = useCallback(
    async (entry: PerforceFileEntry) => {
      setMutation(`diff:${entry.path}`)
      try {
        const content = await window.api.perforce.diff({ worktreePath, filePath: entry.path })
        setDiff({ path: entry.path, content: content || 'No textual diff is available.' })
      } catch (caught) {
        toast.error('Failed to load diff', {
          description: caught instanceof Error ? caught.message : String(caught)
        })
      } finally {
        setMutation(null)
      }
    },
    [worktreePath]
  )

  const runSubmission = useCallback(
    async (kind: 'submit' | 'shelve') => {
      const description = message.trim()
      if (!description) {
        return
      }
      setMutation(kind)
      try {
        const result = await window.api.perforce[kind]({ worktreePath, message: description })
        if (!result.success) {
          throw new Error(result.error || `Perforce ${kind} failed`)
        }
        setMessage('')
        toast.success(
          kind === 'submit'
            ? 'Changelist submitted'
            : `Shelved${result.changelist ? ` as ${result.changelist}` : ''}`
        )
        await refresh()
      } catch (caught) {
        toast.error(`Perforce ${kind} failed`, {
          description: caught instanceof Error ? caught.message : String(caught)
        })
      } finally {
        setMutation(null)
      }
    },
    [message, refresh, worktreePath]
  )

  const renderGroup = (title: string, entries: PerforceFileEntry[]) => (
    <section>
      <div className="flex h-7 items-center border-b border-border/60 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
        <span className="ml-auto tabular-nums">{entries.length}</span>
      </div>
      {entries.map((entry) => {
        const busy = mutation?.endsWith(entry.path) === true
        return (
          <div
            key={`${entry.area}:${entry.path}`}
            className="group flex min-h-8 items-center gap-2 border-b border-border/40 px-2 text-xs hover:bg-muted/40"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => void openDiff(entry)}
            >
              <span
                className={cn(
                  'w-4 shrink-0 text-center font-mono font-semibold',
                  entry.status === 'deleted' ? 'text-red-400' : 'text-amber-400'
                )}
              >
                {busy ? <Loader2 className="size-3 animate-spin" /> : statusLabel(entry)}
              </span>
              <span className="truncate font-mono" title={entry.path}>
                {entry.path}
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 opacity-70 group-hover:opacity-100"
              title={
                entry.area === 'staged'
                  ? 'Remove from changelist and keep local file'
                  : 'Open in changelist'
              }
              disabled={mutation !== null}
              onClick={() =>
                void mutate(entry.area === 'staged' ? 'Revert' : 'Open', () =>
                  entry.area === 'staged'
                    ? window.api.perforce.revert({ worktreePath, filePath: entry.path })
                    : window.api.perforce.open({ worktreePath, filePath: entry.path })
                )
              }
            >
              {entry.area === 'staged' ? (
                <Undo2 className="size-3.5" />
              ) : (
                <FilePlus2 className="size-3.5" />
              )}
            </Button>
          </div>
        )
      })}
    </section>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">Perforce</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {[status.client, status.stream].filter(Boolean).join(' · ') || 'Client workspace'}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title="Scan for unopened local changes"
          disabled={loading}
          onClick={() => void refresh(true)}
        >
          <ScanSearch className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title="Sync workspace"
          disabled={mutation !== null}
          onClick={() => void mutate('Sync', () => window.api.perforce.sync({ worktreePath }))}
        >
          <Download className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title="Refresh changes"
          disabled={loading}
          onClick={() => void refresh(false)}
        >
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="p-3 text-xs text-destructive">{error}</div>
        ) : status.entries.length === 0 && !loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">No pending changes</div>
        ) : (
          <>
            {renderGroup('Opened in changelist', groups.opened)}
            {renderGroup('Local changes', groups.local)}
          </>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border p-2">
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-h-16 resize-none text-xs"
          placeholder="Changelist description"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            disabled={!message.trim() || groups.opened.length === 0 || mutation !== null}
            onClick={() => void runSubmission('submit')}
          >
            {mutation === 'submit' && <Loader2 className="size-3.5 animate-spin" />}
            Submit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!message.trim() || groups.opened.length === 0 || mutation !== null}
            onClick={() => void runSubmission('shelve')}
          >
            {mutation === 'shelve' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Archive className="size-3.5" />
            )}
            Shelve
          </Button>
        </div>
      </div>

      <Dialog open={diff !== null} onOpenChange={(open) => !open && setDiff(null)}>
        <DialogContent className="flex max-h-[80vh] max-w-4xl flex-col">
          <DialogHeader>
            <DialogTitle className="truncate font-mono text-sm">{diff?.path}</DialogTitle>
          </DialogHeader>
          <pre className="scrollbar-sleek min-h-0 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-5">
            {diff?.content}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}
