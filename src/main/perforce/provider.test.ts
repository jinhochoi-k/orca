import { describe, expect, it, vi } from 'vitest'
import { PerforceProvider, parseP4TaggedOutput, type PerforceRun } from './provider'

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
