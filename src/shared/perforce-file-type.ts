import { hasBinaryFileExtension } from './binary-file-extensions'

export function isBinaryPerforceFile(path: string, fileType?: string): boolean {
  const normalizedType = fileType?.toLowerCase() ?? ''
  return (
    hasBinaryFileExtension(path) ||
    normalizedType.includes('binary') ||
    normalizedType.includes('resource') ||
    normalizedType.startsWith('apple')
  )
}
