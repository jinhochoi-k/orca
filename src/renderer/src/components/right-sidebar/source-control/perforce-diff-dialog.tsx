import { useMemo } from 'react'
import { FileDiff } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { countPerforceDiffChanges, parsePerforceUnifiedDiff } from './perforce-unified-diff'

export type PerforceDiff = {
  path: string
  content: string
  shelvedChangelist?: string
}

export function PerforceDiffDialog({
  diff,
  onOpenChange
}: {
  diff: PerforceDiff | null
  onOpenChange: (open: boolean) => void
}) {
  const lines = useMemo(() => parsePerforceUnifiedDiff(diff?.content ?? ''), [diff?.content])
  const counts = useMemo(() => countPerforceDiffChanges(lines), [lines])

  return (
    <Dialog open={diff !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border bg-muted/30 py-3 pl-4 pr-12">
          <DialogTitle className="flex min-w-0 items-center gap-2 text-sm">
            <FileDiff className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-mono" title={diff?.path}>
              {diff?.path}
            </span>
            <span className="shrink-0 font-mono text-xs font-medium text-[color:var(--git-decoration-added)]">
              +{counts.additions}
            </span>
            <span className="shrink-0 font-mono text-xs font-medium text-[color:var(--git-decoration-deleted)]">
              −{counts.deletions}
            </span>
          </DialogTitle>
          {diff?.shelvedChangelist ? (
            <p className="pl-6 text-[11px] text-muted-foreground">
              Shelved in CL {diff.shelvedChangelist}
            </p>
          ) : null}
        </DialogHeader>
        <div className="scrollbar-editor min-h-0 flex-1 overflow-auto bg-editor-surface py-1 font-mono text-xs leading-5">
          {lines.map((line) => (
            <div
              key={line.id}
              className={cn(
                'grid min-w-max grid-cols-[3.25rem_3.25rem_1.25rem_minmax(0,1fr)]',
                line.kind === 'add' &&
                  'bg-[color-mix(in_srgb,var(--git-decoration-added)_14%,transparent)]',
                line.kind === 'remove' &&
                  'bg-[color-mix(in_srgb,var(--git-decoration-deleted)_14%,transparent)]',
                line.kind === 'hunk' &&
                  'my-1 border-y border-border bg-muted/50 text-muted-foreground',
                line.kind === 'file' && 'border-b border-border bg-muted/30 font-semibold',
                line.kind === 'meta' && 'text-muted-foreground'
              )}
            >
              <span className="select-none border-r border-border/40 pr-2 text-right text-[10px] text-muted-foreground/70">
                {line.oldLine}
              </span>
              <span className="select-none border-r border-border/40 pr-2 text-right text-[10px] text-muted-foreground/70">
                {line.newLine}
              </span>
              <span
                className={cn(
                  'select-none text-center font-semibold text-muted-foreground',
                  line.kind === 'add' && 'text-[color:var(--git-decoration-added)]',
                  line.kind === 'remove' && 'text-[color:var(--git-decoration-deleted)]'
                )}
              >
                {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ''}
              </span>
              <span className="whitespace-pre pr-4">
                {line.kind === 'add' || line.kind === 'remove'
                  ? line.content.slice(1)
                  : line.content}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
