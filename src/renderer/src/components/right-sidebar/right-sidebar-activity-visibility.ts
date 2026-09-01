import type { ActivityBarItem } from './activity-bar-buttons'

type RightSidebarActivityVisibilityState = {
  isFolder: boolean
  isFolderWorkspace: boolean
  isSshRepo: boolean
  hasSourceControl?: boolean
}

export function getVisibleRightSidebarActivityItems(
  items: ActivityBarItem[],
  { isFolder, isFolderWorkspace, isSshRepo, hasSourceControl }: RightSidebarActivityVisibilityState
): ActivityBarItem[] {
  return items.filter(
    (item) =>
      (!item.gitOnly || !isFolder) &&
      (!item.sourceControlOnly || hasSourceControl === true) &&
      (!item.folderOnly || (isFolderWorkspace && hasSourceControl !== true)) &&
      (!item.sshOnly || isSshRepo)
  )
}
