import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { translate } from '@/i18n/i18n'

export function RepositoryPerforceMigrationControl({
  path,
  canMigrate,
  onMigrate
}: {
  path: string
  canMigrate: boolean
  onMigrate: () => void | Promise<boolean>
}) {
  const [migrating, setMigrating] = useState(false)

  const migrate = async (): Promise<void> => {
    setMigrating(true)
    try {
      const info = await window.api.perforce.info({ worktreePath: path })
      if (!info.available || !info.isWorkspace) {
        throw new Error(info.error || 'This folder is not inside a Perforce client workspace')
      }
      if (!(await onMigrate())) {
        throw new Error('Project type was not updated')
      }
      toast.success('Perforce source control enabled', { description: info.client })
    } catch (caught) {
      toast.error('Could not enable Perforce source control', {
        description: caught instanceof Error ? caught.message : String(caught)
      })
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.settings.RepositoryPane.ee5a290616',
          'Opened as folder. Git features are unavailable for this workspace.'
        )}
      </p>
      {canMigrate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={migrating}
          onClick={() => void migrate()}
        >
          {migrating ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Enable Perforce source control
        </Button>
      ) : null}
    </div>
  )
}
