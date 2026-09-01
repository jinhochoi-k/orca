import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { track } from '@/lib/telemetry'
import { hasSourceControl } from '../../../../shared/repo-kind'
import {
  buildNestedRepoScanTelemetry,
  createNestedRepoTelemetryAttemptId
} from '../../../../shared/nested-repo-telemetry'
import type { AddRepoExistingWorkspaceSource } from '../../../../shared/telemetry-events'
import type { WorktreeFetchOptions } from '@/store/slices/worktree-helpers'
import type { RepoSlice } from '@/store/repos/repo-state'
import { addLocalPerforceWorkspace, type LocalPathAddResult } from './add-local-perforce-workspace'
import type { ShowNestedRepoReview } from './add-repo-local-types'
import { rejectLocalFolderForRemoteRuntime } from './local-folder-runtime-guard'
import { createNestedRepoScanId } from './add-repo-dialog-types'
import { translate } from '@/i18n/i18n'
import { worktreeRefreshOptions } from './add-repo-runtime-owner'
import type { ExecutionHostId } from '../../../../shared/execution-host'

type LocalPathAddMode = 'single' | 'batch'

export function useAddRepoLocalFolderFlow({
  isOpen,
  droppedLocalPath,
  activeRuntimeEnvironmentId,
  addRepoPath,
  closeModal,
  fetchWorktrees,
  scanNestedRepos,
  setActiveNestedScanId,
  setNestedScanInProgress,
  showNestedRepoReview,
  onGitRepoReady,
  setIsAdding,
  setAddProjectBusyLabel
}: {
  isOpen: boolean
  droppedLocalPath: string
  activeRuntimeEnvironmentId: string | null | undefined
  addRepoPath: RepoSlice['addRepoPath']
  closeModal: () => void
  fetchWorktrees: (repoId: string, options?: WorktreeFetchOptions) => Promise<unknown>
  scanNestedRepos: RepoSlice['scanNestedRepos']
  setActiveNestedScanId: (scanId: string | null, runtimeEnvironmentId?: string | null) => void
  setNestedScanInProgress: (inProgress: boolean) => void
  showNestedRepoReview: ShowNestedRepoReview
  onGitRepoReady: (
    repoId: string,
    source: AddRepoExistingWorkspaceSource,
    executionHostId?: ExecutionHostId
  ) => Promise<void>
  setIsAdding: (isAdding: boolean) => void
  setAddProjectBusyLabel: (label: string | null) => void
}): {
  handleBrowse: () => Promise<void>
  resetLocalFolderFlow: () => void
} {
  const localAddGenRef = useRef(0)
  const droppedLocalPathHandledRef = useRef<string | null>(null)

  const resetLocalFolderFlow = useCallback((): void => {
    localAddGenRef.current++
    droppedLocalPathHandledRef.current = null
  }, [])

  const clearNestedScanState = useCallback((): void => {
    setNestedScanInProgress(false)
    setActiveNestedScanId(null)
  }, [setActiveNestedScanId, setNestedScanInProgress])

  const addLocalPathForGeneration = useCallback(
    async (
      path: string,
      source: AddRepoExistingWorkspaceSource,
      gen: number,
      mode: LocalPathAddMode = 'single'
    ): Promise<LocalPathAddResult> => {
      if (
        rejectLocalFolderForRemoteRuntime({
          runtimeEnvironmentId: activeRuntimeEnvironmentId,
          closeModal
        })
      ) {
        return { status: 'paused' }
      }
      const perforceResult = await addLocalPerforceWorkspace({
        path,
        source,
        addRepoPath,
        fetchWorktrees,
        onSourceControlRepoReady: onGitRepoReady,
        setBusyLabel: setAddProjectBusyLabel,
        isCurrent: () => gen === localAddGenRef.current,
        deferReady: mode === 'batch'
      })
      if (perforceResult) {
        return perforceResult
      }
      setAddProjectBusyLabel('Scanning for repositories...')
      try {
        const attemptId = createNestedRepoTelemetryAttemptId()
        const scanId = createNestedRepoScanId()
        setActiveNestedScanId(scanId, activeRuntimeEnvironmentId ?? null)
        setNestedScanInProgress(true)
        const scan = await scanNestedRepos(path, undefined, {
          scanId,
          runtimeEnvironmentId: activeRuntimeEnvironmentId ?? null,
          onProgress: (progressScan) => {
            if (
              gen !== localAddGenRef.current ||
              mode === 'batch' ||
              progressScan.selectedPathKind !== 'non_git_folder' ||
              progressScan.repos.length === 0
            ) {
              return
            }
            showNestedRepoReview({
              scan: progressScan,
              selectedPath: path,
              connectionId: null,
              attemptId,
              runtimeKind: 'local',
              inProgress: true,
              scanId,
              runtimeEnvironmentId: activeRuntimeEnvironmentId
            })
          }
        })
        if (gen !== localAddGenRef.current) {
          return { status: 'cancelled' }
        }
        clearNestedScanState()
        track(
          'add_repo_nested_scan_result',
          buildNestedRepoScanTelemetry({
            attemptId,
            surface: 'sidebar',
            runtimeKind: 'local',
            scan
          })
        )
        if (scan?.selectedPathKind === 'non_git_folder' && mode === 'batch') {
          return { status: 'skipped' }
        }
        if (scan?.selectedPathKind === 'non_git_folder' && scan.repos.length > 0) {
          // Why: a single-folder decision point cannot queue competing batch review states.
          showNestedRepoReview({
            scan,
            selectedPath: path,
            connectionId: null,
            attemptId,
            runtimeKind: 'local',
            inProgress: false,
            scanId,
            runtimeEnvironmentId: activeRuntimeEnvironmentId
          })
          return { status: 'paused' }
        }
        setAddProjectBusyLabel('Opening project...')
        const repo = await addRepoPath(path, undefined, {
          runtimeEnvironmentId: activeRuntimeEnvironmentId ?? null
        })
        if (gen !== localAddGenRef.current) {
          return { status: 'cancelled' }
        }
        if (!repo) {
          return { status: 'paused' }
        }
        if (hasSourceControl(repo)) {
          // Why: a transient non-authoritative refresh must not strand a persisted repo.
          const ownerOptions = worktreeRefreshOptions(activeRuntimeEnvironmentId ?? null)
          await fetchWorktrees(repo.id, ownerOptions)
          if (gen !== localAddGenRef.current) {
            return { status: 'cancelled' }
          }
          if (mode === 'batch') {
            return { status: 'completed', repo }
          }
          await onGitRepoReady(repo.id, source, ownerOptions.executionHostId)
        } else {
          // Why: folder repos skip the Git default-checkout handoff and activate
          // their synthetic root workspace in the folder add flow.
          closeModal()
        }
        return { status: 'completed', repo }
      } finally {
        if (gen === localAddGenRef.current) {
          clearNestedScanState()
        }
      }
    },
    [
      activeRuntimeEnvironmentId,
      addRepoPath,
      clearNestedScanState,
      closeModal,
      fetchWorktrees,
      onGitRepoReady,
      scanNestedRepos,
      setActiveNestedScanId,
      setAddProjectBusyLabel,
      setNestedScanInProgress,
      showNestedRepoReview
    ]
  )

  const handleAddLocalPath = useCallback(
    async (
      path: string,
      source: AddRepoExistingWorkspaceSource,
      mode: LocalPathAddMode = 'single'
    ): Promise<LocalPathAddResult> => {
      const gen = ++localAddGenRef.current
      setIsAdding(true)
      try {
        return await addLocalPathForGeneration(path, source, gen, mode)
      } finally {
        if (gen === localAddGenRef.current) {
          clearNestedScanState()
          setIsAdding(false)
          setAddProjectBusyLabel(null)
        }
      }
    },
    [addLocalPathForGeneration, clearNestedScanState, setAddProjectBusyLabel, setIsAdding]
  )

  const handleAddLocalPaths = useCallback(
    async (paths: string[], source: AddRepoExistingWorkspaceSource, gen: number): Promise<void> => {
      const sourceControlRepoIds: string[] = []
      const shouldDeferGitRepoReady = paths.length > 1
      let skippedCount = 0
      for (const path of paths) {
        const result = await addLocalPathForGeneration(
          path,
          source,
          gen,
          shouldDeferGitRepoReady ? 'batch' : 'single'
        )
        if (result.status === 'skipped') {
          skippedCount++
          continue
        }
        if (result.status !== 'completed') {
          return
        }
        if (hasSourceControl(result.repo)) {
          sourceControlRepoIds.push(result.repo.id)
        }
      }
      if (gen !== localAddGenRef.current) {
        return
      }
      if (skippedCount > 0) {
        toast.info(
          translate(
            'auto.components.sidebar.useAddRepoLocalFolderFlow.skippedBatchFolders',
            'Some folders were skipped'
          ),
          {
            description: translate(
              'auto.components.sidebar.useAddRepoLocalFolderFlow.skippedBatchFoldersDescription',
              'Add skipped folders individually to review or confirm them.'
            )
          }
        )
      }
      if (shouldDeferGitRepoReady && sourceControlRepoIds.length > 0) {
        await onGitRepoReady(
          sourceControlRepoIds[0],
          source,
          worktreeRefreshOptions(activeRuntimeEnvironmentId ?? null).executionHostId
        )
      }
    },
    [activeRuntimeEnvironmentId, addLocalPathForGeneration, onGitRepoReady]
  )

  useEffect(() => {
    if (!isOpen || !droppedLocalPath) {
      return
    }
    if (droppedLocalPathHandledRef.current === droppedLocalPath) {
      return
    }
    droppedLocalPathHandledRef.current = droppedLocalPath
    void handleAddLocalPath(droppedLocalPath, 'local_folder_picker')
  }, [droppedLocalPath, handleAddLocalPath, isOpen])

  const handleBrowse = useCallback(async (): Promise<void> => {
    const gen = ++localAddGenRef.current
    setIsAdding(true)
    setAddProjectBusyLabel('Choose a folder...')
    try {
      const paths = await window.api.repos.pickFolders()
      if (paths.length === 0 || gen !== localAddGenRef.current) {
        return
      }
      await handleAddLocalPaths(paths, 'local_folder_picker', gen)
    } finally {
      if (gen === localAddGenRef.current) {
        clearNestedScanState()
        setIsAdding(false)
        setAddProjectBusyLabel(null)
      }
    }
  }, [clearNestedScanState, handleAddLocalPaths, setAddProjectBusyLabel, setIsAdding])

  return { handleBrowse, resetLocalFolderFlow }
}
