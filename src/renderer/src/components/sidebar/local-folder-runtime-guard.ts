import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'

export function rejectLocalFolderForRemoteRuntime({
  runtimeEnvironmentId,
  closeModal
}: {
  runtimeEnvironmentId: string | null | undefined
  closeModal: () => void
}): boolean {
  if (!runtimeEnvironmentId?.trim()) {
    return false
  }
  toast.error(
    translate(
      'auto.components.sidebar.useAddRepoLocalFolderFlow.7ab10e4974',
      'Use a host path to add projects from a remote host.'
    )
  )
  closeModal()
  return true
}
