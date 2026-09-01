import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export function PerforceCreateChangelistDialog({
  open,
  creating,
  onOpenChange,
  onCreate
}: {
  open: boolean
  creating: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (description: string) => void
}) {
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) {
      setDescription('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create changelist</DialogTitle>
        </DialogHeader>
        <Textarea
          autoFocus
          value={description}
          className="min-h-24 resize-y text-sm"
          placeholder="Changelist description"
          onChange={(event) => setDescription(event.target.value)}
        />
        <DialogFooter>
          <Button
            disabled={creating || !description.trim()}
            onClick={() => onCreate(description.trim())}
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
