import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/store'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'
import type { Repo } from '../../../../../shared/repo-types'

export function PerforceSubmitPolicyControl({ repo }: { repo: Repo }) {
  const updateRepo = useAppStore((state) => state.updateRepo)
  const [saving, setSaving] = useState(false)

  const setSubmitDisabled = useCallback(
    async (disabled: boolean) => {
      setSaving(true)
      try {
        const updated = await updateRepo(
          repo.id,
          { perforceSubmitDisabled: disabled },
          { hostId: getRepoExecutionHostId(repo) }
        )
        if (!updated) {
          throw new Error('Project setting was not saved')
        }
      } catch (caught) {
        toast.error('Failed to update Perforce submit policy', {
          description: caught instanceof Error ? caught.message : String(caught)
        })
      } finally {
        setSaving(false)
      }
    },
    [repo, updateRepo]
  )

  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-2 py-1.5 text-xs">
      <span>
        <span className="block font-medium">Disable submit</span>
        <span className="block text-[10px] text-muted-foreground">
          Shelve and changelist operations remain available.
        </span>
      </span>
      <Switch
        checked={repo.perforceSubmitDisabled === true}
        disabled={saving}
        aria-label="Disable Perforce submit"
        onCheckedChange={(checked) => void setSubmitDisabled(checked)}
      />
    </label>
  )
}
