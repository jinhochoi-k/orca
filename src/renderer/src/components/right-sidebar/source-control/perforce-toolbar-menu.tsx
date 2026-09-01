import { useCallback, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'
import type { Repo } from '../../../../../shared/repo-types'

export function PerforceToolbarMenu({ repo }: { repo: Repo }) {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="Perforce options">
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-56">
        <DropdownMenuLabel>Perforce safety</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={repo.perforceSubmitDisabled === true}
          disabled={saving}
          onCheckedChange={(checked) => void setSubmitDisabled(checked === true)}
        >
          Disable submit
        </DropdownMenuCheckboxItem>
        <p className="px-2 py-1 text-[10px] leading-4 text-muted-foreground">
          Changelist and shelved-file inspection remain available.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
