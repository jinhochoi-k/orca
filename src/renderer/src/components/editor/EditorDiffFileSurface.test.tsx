import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { OpenFile } from '@/store/slices/editor'

vi.mock('@/lib/lazy-with-retry', () => ({
  lazyWithRetry: () => () => null
}))

import { EditorDiffFileSurface } from './EditorDiffFileSurface'

describe('EditorDiffFileSurface', () => {
  it('explains why Unreal assets do not have a text diff', () => {
    const activeFile = {
      id: 'shelf-asset',
      filePath: 'C:\\work\\.orca-shelved\\123\\Character.uasset',
      relativePath: '//depot/game/Character.uasset',
      worktreeId: 'wt-1',
      language: 'plaintext',
      isDirty: false,
      mode: 'diff',
      diffSource: 'perforce-shelved'
    } as OpenFile

    const html = renderToStaticMarkup(
      <EditorDiffFileSurface
        activeFile={activeFile}
        diffContent={{
          kind: 'binary',
          originalContent: '',
          modifiedContent: '',
          originalIsBinary: true,
          modifiedIsBinary: true
        }}
        editBuffer={undefined}
        resolvedLanguage="plaintext"
        sideBySide={false}
        viewStateScopeId="shelf-asset"
        diffViewStateKey="shelf-asset:diff"
        mdViewMode="source"
        isMarkdown={false}
        showMarkdownTableOfContents={false}
        onCloseMarkdownTableOfContents={vi.fn()}
        markdownAnnotationsEnabled={false}
        markdownDocuments={{} as never}
        onContentChange={vi.fn()}
        onSave={vi.fn()}
        reloadContent={vi.fn()}
      />
    )

    expect(html).toContain('Unreal asset changed')
    expect(html).toContain('Unreal asset files are binary')
    expect(html).toContain('Unreal Editor')
  })
})
