import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PerforceChangelistSection, PerforceLocalChanges } from './perforce-changelist-section'

const changes = [
  {
    id: '1234567',
    description: 'PUBG-000000 Feature work',
    files: [
      {
        path: 'Tsl/Source/TslGame/Feature.cpp',
        status: 'modified' as const,
        area: 'staged' as const,
        changelist: '1234567'
      }
    ]
  },
  { id: 'default', description: 'Default changelist', files: [] }
]

describe('PerforceChangelistSection', () => {
  it('renders a numbered changelist, its open files, and deferred shelved-file action', () => {
    const html = renderToStaticMarkup(
      <PerforceChangelistSection
        changelist={changes[0]}
        changelists={changes}
        shelvedLoading={false}
        busyPath={null}
        onDiff={vi.fn()}
        onMove={vi.fn()}
        onLoadShelved={vi.fn()}
        onShelvedDiff={vi.fn()}
      />
    )

    expect(html).toContain('CL 1234567')
    expect(html).toContain('PUBG-000000 Feature work')
    expect(html).toContain('Tsl/Source/TslGame/Feature.cpp')
    expect(html).toContain('View shelved files')
  })

  it('renders shelved depot files after they are loaded', () => {
    const html = renderToStaticMarkup(
      <PerforceChangelistSection
        changelist={changes[0]}
        changelists={changes}
        shelvedFiles={[{ depotPath: '//PUBG/mainline/Tsl/Feature.cpp', status: 'added' }]}
        shelvedLoading={false}
        busyPath={null}
        onDiff={vi.fn()}
        onMove={vi.fn()}
        onLoadShelved={vi.fn()}
        onShelvedDiff={vi.fn()}
      />
    )

    expect(html).toContain('Shelved files')
    expect(html).toContain('//PUBG/mainline/Tsl/Feature.cpp')
  })
})

describe('PerforceLocalChanges', () => {
  it('renders unopened files separately from changelists', () => {
    const html = renderToStaticMarkup(
      <PerforceLocalChanges
        entries={[{ path: 'Local.cpp', status: 'modified', area: 'unstaged' }]}
        changelists={changes}
        busyPath={null}
        onDiff={vi.fn()}
        onMove={vi.fn()}
      />
    )

    expect(html).toContain('Local changes')
    expect(html).toContain('Local.cpp')
  })
})
