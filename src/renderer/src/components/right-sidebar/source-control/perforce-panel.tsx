import { useCallback, useEffect, useState } from 'react'
import { Download, FilePlus2, RefreshCw, ScanSearch } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { isBinaryPerforceFile } from '../../../../../shared/perforce-file-type'
import type {
  PerforceChangelistsResult,
  PerforceFileEntry,
  PerforceShelvedFile
} from '../../../../../shared/perforce-types'
import type { Repo } from '../../../../../shared/repo-types'
import { PerforceChangelistSection, PerforceLocalChanges } from './perforce-changelist-section'
import { PerforceCreateChangelistDialog } from './perforce-create-changelist-dialog'
import { openPerforceOpenedDiffTab } from './open-perforce-opened-diff'
import { PerforceToolbarMenu } from './perforce-toolbar-menu'
import { openPerforceShelvedDiffTab } from './open-perforce-shelved-diff'

const EMPTY_CHANGESETS: PerforceChangelistsResult = { changelists: [], localChanges: [] }

export function PerforceSourceControlPanel({
  repo,
  worktreeId,
  worktreePath
}: {
  repo: Repo
  worktreeId: string
  worktreePath: string
}) {
  const openFile = useAppStore((state) => state.openFile)
  const [data, setData] = useState<PerforceChangelistsResult>(EMPTY_CHANGESETS)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mutation, setMutation] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [shelvedByChange, setShelvedByChange] = useState<Record<string, PerforceShelvedFile[]>>({})

  const refresh = useCallback(
    async (includeUnopened = false) => {
      setLoading(true)
      try {
        setData(await window.api.perforce.changelists({ worktreePath, includeUnopened }))
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

  const mutate = useCallback(
    async (label: string, action: () => Promise<void>) => {
      setMutation(label)
      try {
        await action()
        await refresh(false)
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
    (entry: PerforceFileEntry) => {
      if (isBinaryPerforceFile(entry.path, entry.fileType)) {
        toast.info('Diff preview unavailable', {
          description: `${entry.path} is stored as a binary Perforce file.`
        })
        return
      }
      openPerforceOpenedDiffTab(openFile, { entry, worktreeId, worktreePath })
    },
    [openFile, worktreeId, worktreePath]
  )

  const moveFile = useCallback(
    (entry: PerforceFileEntry, changelist: string) => {
      void mutate(`Move ${entry.path}`, async () => {
        if (entry.area !== 'staged') {
          await window.api.perforce.open({ worktreePath, filePath: entry.path })
        }
        await window.api.perforce.moveFiles({ worktreePath, changelist, filePaths: [entry.path] })
      })
    },
    [mutate, worktreePath]
  )

  const createChangelist = useCallback(
    async (description: string) => {
      setMutation('create-changelist')
      try {
        const result = await window.api.perforce.createChangelist({ worktreePath, description })
        if (!result.success) {
          throw new Error(result.error || 'Perforce changelist creation failed')
        }
        setCreateOpen(false)
        toast.success(`CL ${result.changelist} created`)
        await refresh(false)
      } catch (caught) {
        toast.error('Failed to create changelist', {
          description: caught instanceof Error ? caught.message : String(caught)
        })
      } finally {
        setMutation(null)
      }
    },
    [refresh, worktreePath]
  )

  const loadShelved = useCallback(
    async (changelist: string) => {
      setMutation(`shelved:${changelist}`)
      try {
        const files = await window.api.perforce.shelvedFiles({ worktreePath, changelist })
        setShelvedByChange((current) => ({ ...current, [changelist]: files }))
      } catch (caught) {
        toast.error('Failed to load shelved files', {
          description: caught instanceof Error ? caught.message : String(caught)
        })
      } finally {
        setMutation(null)
      }
    },
    [worktreePath]
  )

  const openShelvedDiff = useCallback(
    (changelist: string, entry: PerforceShelvedFile) => {
      openPerforceShelvedDiffTab(openFile, { changelist, entry, worktreeId, worktreePath })
    },
    [openFile, worktreeId, worktreePath]
  )

  const hasChanges =
    data.localChanges.length > 0 || data.changelists.some((change) => change.files.length > 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">Perforce</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {[data.client, data.stream].filter(Boolean).join(' · ') || 'Client workspace'}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Create changelist"
          onClick={() => setCreateOpen(true)}
        >
          <FilePlus2 className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Scan for local changes"
          disabled={loading}
          onClick={() => void refresh(true)}
        >
          <ScanSearch className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Sync workspace"
          disabled={mutation !== null}
          onClick={() => void mutate('Sync', () => window.api.perforce.sync({ worktreePath }))}
        >
          <Download className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Refresh changelists"
          disabled={loading}
          onClick={() => void refresh(false)}
        >
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
        </Button>
        <PerforceToolbarMenu repo={repo} />
      </div>

      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="p-3 text-xs text-destructive">{error}</div>
        ) : !hasChanges && data.changelists.length <= 1 && !loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No pending changelists or local changes
          </div>
        ) : (
          <>
            {data.changelists.map((changelist) => (
              <PerforceChangelistSection
                key={changelist.id}
                changelist={changelist}
                changelists={data.changelists}
                shelvedFiles={shelvedByChange[changelist.id]}
                shelvedLoading={mutation === `shelved:${changelist.id}`}
                busyPath={mutation}
                onDiff={openDiff}
                onMove={moveFile}
                onLoadShelved={() => void loadShelved(changelist.id)}
                onShelvedDiff={(entry) => void openShelvedDiff(changelist.id, entry)}
              />
            ))}
            <PerforceLocalChanges
              entries={data.localChanges}
              changelists={data.changelists}
              busyPath={mutation}
              onDiff={openDiff}
              onMove={moveFile}
            />
          </>
        )}
      </div>

      <PerforceCreateChangelistDialog
        open={createOpen}
        creating={mutation === 'create-changelist'}
        onOpenChange={setCreateOpen}
        onCreate={(description) => void createChangelist(description)}
      />
    </div>
  )
}
