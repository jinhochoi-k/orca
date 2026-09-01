import { describe, expect, it, vi } from 'vitest'
import {
  extractShelvedFileDiff,
  PerforceProvider,
  parseP4TaggedOutput,
  type PerforceRun
} from './provider'

function result(stdout = '', code = 0, stderr = '') {
  return { code, stdout, stderr }
}

describe('parseP4TaggedOutput', () => {
  it('splits records when a tag repeats', () => {
    expect(
      parseP4TaggedOutput(
        [
          '... depotFile //depot/main/a.ts',
          '... clientFile C:\\work\\a.ts',
          '... action edit',
          '... depotFile //depot/main/b.ts',
          '... clientFile C:\\work\\b.ts',
          '... action add'
        ].join('\n')
      )
    ).toEqual([
      {
        depotFile: '//depot/main/a.ts',
        clientFile: 'C:\\work\\a.ts',
        action: 'edit'
      },
      {
        depotFile: '//depot/main/b.ts',
        clientFile: 'C:\\work\\b.ts',
        action: 'add'
      }
    ])
  })
})

describe('extractShelvedFileDiff', () => {
  it('returns only the requested depot file section', () => {
    const output = [
      'Change 123 by user@client on 2026/09/01',
      '==== //depot/main/a.ts#1 - //depot/main/a.ts@=123 (text) ====',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      '==== //depot/main/b.ts#2 - //depot/main/b.ts@=123 (text) ====',
      '@@ -1 +1 @@'
    ].join('\n')

    expect(extractShelvedFileDiff(output, '//depot/main/a.ts')).toContain('+new')
    expect(extractShelvedFileDiff(output, '//depot/main/a.ts')).not.toContain('b.ts')
  })
})

describe('PerforceProvider', () => {
  it('does not accept a directory above the selected client root', async () => {
    const run = vi.fn<PerforceRun>(async () =>
      result('... clientName ws\n... clientRoot C:\\work\\mainline')
    )

    await expect(new PerforceProvider(run).info('C:\\work')).resolves.toMatchObject({
      available: true,
      isWorkspace: false,
      client: 'ws'
    })
  })

  it('combines opened and reconcile-preview changes without duplicates', async () => {
    const run = vi.fn<PerforceRun>(async (args) => {
      const command = args.join(' ')
      if (command === '-ztag info') {
        return result(
          [
            '... userName jinho',
            '... clientName jinho_ws',
            '... clientRoot C:\\work',
            '... clientStream //streams/main'
          ].join('\n')
        )
      }
      if (command === '-ztag opened ...') {
        return result(
          [
            '... depotFile //depot/main/a.ts',
            '... clientFile C:\\work\\a.ts',
            '... action edit',
            '... change default'
          ].join('\n')
        )
      }
      return result(
        [
          '... depotFile //depot/main/a.ts',
          '... clientFile C:\\work\\a.ts',
          '... action edit',
          '... depotFile //depot/main/new.ts',
          '... clientFile C:\\work\\new.ts',
          '... action add'
        ].join('\n')
      )
    })

    const status = await new PerforceProvider(run).status('C:\\work', { includeUnopened: true })

    expect(status).toMatchObject({
      client: 'jinho_ws',
      stream: '//streams/main',
      user: 'jinho'
    })
    expect(status.entries).toEqual([
      {
        path: 'a.ts',
        status: 'modified',
        area: 'staged',
        changelist: 'default',
        depotPath: '//depot/main/a.ts'
      },
      {
        path: 'new.ts',
        status: 'added',
        area: 'untracked',
        depotPath: '//depot/main/new.ts'
      }
    ])
  })

  it('maps opening a new local file to p4 add', async () => {
    const run = vi.fn<PerforceRun>(async (args) => {
      if (args[0] === '-ztag') {
        return result('... clientFile C:\\work\\new.ts\n... action add')
      }
      return result()
    })

    await new PerforceProvider(run).open('C:\\work', 'new.ts')

    expect(run.mock.calls[1]?.[0]).toEqual(['add', 'C:\\work\\new.ts'])
  })

  it('groups open files under pending changelists', async () => {
    const run = vi.fn<PerforceRun>(async (args) => {
      const command = args.join(' ')
      if (command === '-ztag info') {
        return result('... userName jinho\n... clientName ws\n... clientRoot C:\\work')
      }
      if (command.startsWith('-ztag changes')) {
        return result('... change 123\n... desc Feature work\n... user jinho\n... client ws')
      }
      if (command === '-ztag opened ...') {
        return result(
          [
            '... depotFile //depot/main/default.ts',
            '... clientFile C:\\work\\default.ts',
            '... action edit',
            '... change default',
            '... depotFile //depot/main/feature.ts',
            '... clientFile C:\\work\\feature.ts',
            '... action edit',
            '... change 123'
          ].join('\n')
        )
      }
      return result()
    })

    const changes = await new PerforceProvider(run).changelists('C:\\work')

    expect(changes.changelists).toMatchObject([
      { id: 'default', files: [{ path: 'default.ts' }] },
      { id: '123', description: 'Feature work', files: [{ path: 'feature.ts' }] }
    ])
    expect(run.mock.calls.some(([args]) => args.includes('-m') && args.includes('100'))).toBe(true)
  })

  it('creates and moves files between numbered changelists', async () => {
    const run = vi.fn<PerforceRun>(async (args) =>
      args.join(' ') === 'change -i' ? result('Change 321 created.') : result()
    )
    const provider = new PerforceProvider(run)

    await expect(provider.createPendingChangelist('C:\\work', 'Feature')).resolves.toEqual({
      success: true,
      changelist: '321'
    })
    await provider.moveFiles('C:\\work', '321', ['a.ts'])

    expect(run).toHaveBeenLastCalledWith(['reopen', '-c', '321', 'C:\\work\\a.ts'], {
      cwd: 'C:\\work'
    })
  })

  it('loads shelved files and an individual shelved diff on demand', async () => {
    const run = vi.fn<PerforceRun>(async (args) => {
      if (args.join(' ') === '-ztag describe -S -s 123') {
        return result('... depotFile0 //depot/main/a.ts\n... action0 edit\n... rev0 7')
      }
      return result(
        '==== //depot/main/a.ts#7 - //depot/main/a.ts@=123 (text) ====\n@@ -1 +1 @@\n-old\n+new'
      )
    })
    const provider = new PerforceProvider(run)

    await expect(provider.shelvedFiles('C:\\work', '123')).resolves.toEqual([
      { depotPath: '//depot/main/a.ts', status: 'modified', revision: '7' }
    ])
    await expect(provider.shelvedDiff('C:\\work', '123', '//depot/main/a.ts')).resolves.toContain(
      '+new'
    )
  })

  it('loads full base and shelved file content for editor diff tabs', async () => {
    const run = vi.fn<PerforceRun>(async (args) =>
      result(args.at(-1)?.includes('@=123') ? 'shelved content' : 'base content')
    )

    await expect(
      new PerforceProvider(run).shelvedFileContent('C:\\work', '123', {
        depotPath: '//depot/main/a.ts',
        status: 'modified',
        revision: '7'
      })
    ).resolves.toEqual({ originalContent: 'base content', modifiedContent: 'shelved content' })
    expect(run.mock.calls.map(([args]) => args)).toEqual([
      ['print', '-q', '//depot/main/a.ts#7'],
      ['print', '-q', '//depot/main/a.ts@=123']
    ])
  })

  it('treats Perforce no-change messages as an empty status', async () => {
    const run = vi.fn<PerforceRun>(async (args) => {
      if (args.join(' ') === '-ztag info') {
        return result('... clientName ws\n... clientRoot C:\\work')
      }
      return result('', 1, 'File(s) not opened on this client.')
    })

    await expect(
      new PerforceProvider(run).status('C:\\work', { includeUnopened: true })
    ).resolves.toMatchObject({
      entries: [],
      client: 'ws'
    })
  })

  it('skips the expensive reconcile scan during normal polling', async () => {
    const run = vi.fn<PerforceRun>(async (args) =>
      args.join(' ') === '-ztag info'
        ? result('... clientName ws\n... clientRoot C:\\work')
        : result()
    )

    await new PerforceProvider(run).status('C:\\work')

    expect(run.mock.calls.map(([args]) => args)).toEqual([
      ['-ztag', 'info'],
      ['-ztag', 'opened', '...']
    ])
  })

  it('uses metadata-only revert so removing a file from a changelist keeps edits', async () => {
    const run = vi.fn<PerforceRun>(async () => result())

    await new PerforceProvider(run).revert('C:\\work', 'a.ts')

    expect(run).toHaveBeenCalledWith(['revert', '-k', 'C:\\work\\a.ts'], {
      cwd: 'C:\\work'
    })
  })

  it('submits through a dedicated changelist scoped to the project path', async () => {
    const run = vi.fn<PerforceRun>(async (args) => {
      if (args.join(' ') === '-ztag opened ...') {
        return result(
          '... depotFile //depot/main/a.ts\n... clientFile C:\\work\\a.ts\n... action edit\n... change default'
        )
      }
      return args.join(' ') === 'change -i' ? result('Change 123 created.') : result()
    })

    await expect(new PerforceProvider(run).submit('C:\\work', 'Fix it')).resolves.toEqual({
      success: true,
      changelist: '123'
    })
    expect(run.mock.calls.map(([args]) => args)).toEqual([
      ['-ztag', 'opened', '...'],
      ['change', '-i'],
      ['reopen', '-c', '123', 'C:\\work\\a.ts'],
      ['submit', '-c', '123']
    ])
  })

  it('does not move files out of existing numbered changelists', async () => {
    const run = vi.fn<PerforceRun>(async () =>
      result(
        '... depotFile //depot/main/a.ts\n... clientFile C:\\work\\a.ts\n... action edit\n... change 456'
      )
    )

    await expect(new PerforceProvider(run).submit('C:\\work', 'Fix it')).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('numbered changelists')
    })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('rejects paths outside the client root before invoking p4', async () => {
    const run = vi.fn<PerforceRun>(async () => result())

    await expect(new PerforceProvider(run).diff('C:\\work', '..\\secret.txt')).rejects.toThrow(
      'outside the workspace root'
    )
    expect(run).not.toHaveBeenCalled()
  })
})
