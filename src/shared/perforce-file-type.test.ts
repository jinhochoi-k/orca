import { describe, expect, it } from 'vitest'
import { isBinaryPerforceFile } from './perforce-file-type'

describe('isBinaryPerforceFile', () => {
  it('recognizes depot binary types without relying on an extension', () => {
    expect(isBinaryPerforceFile('Content/Data.custom', 'binary+l')).toBe(true)
    expect(isBinaryPerforceFile('Source/Main.cpp', 'text')).toBe(false)
  })

  it('keeps known binary assets out of text previews when type metadata is unavailable', () => {
    expect(isBinaryPerforceFile('Content/Character.uasset')).toBe(true)
  })
})
