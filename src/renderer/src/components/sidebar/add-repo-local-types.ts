import type { NestedRepoTelemetryRuntimeKind } from '../../../../shared/nested-repo-telemetry'
import type { NestedRepoScanResult } from '../../../../shared/project-group-types'

export type ShowNestedRepoReview = (args: {
  scan: NestedRepoScanResult
  selectedPath: string
  connectionId: string | null
  attemptId: string
  runtimeKind: NestedRepoTelemetryRuntimeKind
  inProgress: boolean
  scanId: string | null
  runtimeEnvironmentId?: string | null
}) => void
