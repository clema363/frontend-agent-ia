import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { EditorPage } from '../src/pages/editor-page'
import { createAppStore } from '../src/lib/store'
import { atlasApi } from '../src/api/rtk-api'
import {
  readWorkspaceDraft,
  workspaceStorageKey,
} from '../src/lib/editor-workspace'

vi.mock('../src/components/editor/code-editor', () => ({
  default: ({
    path,
    value,
    onChange,
    stateKey,
  }: {
    path: string
    value: string
    onChange: (value: string) => void
    stateKey: string
  }) => (
    <textarea
      aria-label={`Edit ${path}`}
      value={value}
      data-edit-state-key={stateKey}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

vi.mock('../src/components/editor/code-diff', () => ({
  default: ({
    path,
    before,
    after,
  }: {
    path: string
    before: string
    after: string
  }) => (
    <div aria-label={`Changes in ${path}`}>
      <del>{before}</del>
      <ins>{after}</ins>
    </div>
  ),
}))

it('keeps edits isolated per US, restores closed files, persists drafts and reviews their diff', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const store = createAppStore()
  const button = (label: string) =>
    [...document.querySelectorAll('button')].find(
      (item) => item.textContent === label,
    )!
  const changeStory = async (id: string) => {
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="User story workspace"]',
        )!
        .click(),
    )
    await act(async () =>
      [...document.querySelectorAll<HTMLElement>('[role="option"]')]
        .find((option) => option.textContent?.startsWith(id.toUpperCase()))!
        .click(),
    )
  }
  try {
    await act(async () => {
      root.render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/editor?us=us-109']}>
            <EditorPage />
          </MemoryRouter>
        </Provider>,
      )
      await store.dispatch(atlasApi.endpoints.getStories.initiate()).unwrap()
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    const editor = container.querySelector('textarea')!
    expect(editor.value).toContain('US-109')
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )!.set!.call(editor, '# Edited story\n')
      editor.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(readWorkspaceDraft('us-109').drafts['README.md']).toBe(
      '# Edited story\n',
    )
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      '1 unsaved',
    )
    expect(container.querySelector('[aria-label="Changes"]')?.textContent).toBe('1')
    expect(container.querySelector('file-tree-container')?.shadowRoot?.querySelector('[data-item-path="README.md"]')?.getAttribute('data-item-git-status')).toBe('modified')
    await act(async () => button('Save').click())
    expect(readWorkspaceDraft('us-109').saved['README.md']).toBe(
      '# Edited story\n',
    )
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Close README.md"]')!
        .click(),
    )
    expect(container.querySelector('textarea')).toBeNull()
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('file-tree-container')!
        .shadowRoot!.querySelector<HTMLButtonElement>(
          '[data-item-path="README.md"]',
        )!
        .click(),
    )
    expect(container.querySelector('textarea')?.value).toBe('# Edited story\n')
    await changeStory('us-112')
    expect(container.querySelector('textarea')?.value).toContain('US-112')
    expect(localStorage.getItem(workspaceStorageKey('us-112'))).toBeNull()
    await changeStory('us-109')
    expect(container.querySelector('textarea')?.value).toBe('# Edited story\n')
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Changes"]')!.click(),
    )
    expect(container.querySelector('[aria-label="Changed files"]')?.textContent).toContain('README.md')
    expect(
      container.querySelector('[aria-label="Changes in README.md"]')
        ?.textContent,
    ).toContain('# Edited story')
    await act(async () => button('Review & merge').click())
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      '1 uncommitted file',
    )
    expect(
      document.querySelector('[role="dialog"] a')?.getAttribute('href'),
    ).toContain('/merge_requests/42')
    await act(async () => button('Continue editing').click())
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Files"]')!.click(),
    )
    const previousSession = container.querySelector('textarea')?.dataset.editStateKey
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Discard file changes"]')!.click())
    await act(async () => button('Discard changes').click())
    expect(container.querySelector('textarea')?.value).toContain('US-109')
    expect(container.querySelector('textarea')?.dataset.editStateKey).not.toBe(previousSession)
    expect(readWorkspaceDraft('us-109')).toEqual({ drafts: {}, saved: {}, commits: [] })
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Search files"]')!.click(),
    )
    const findFile = container.querySelector<HTMLInputElement>('[aria-label="Find a file"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(findFile, 'nonexistent-file')
      findFile.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.textContent).toContain('No matching files.')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(findFile, '')
      findFile.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.textContent).not.toContain('No matching files.')

    // Manual commit: commits every changed file, then diffs against that commit.
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Files"]')!.click(),
    )
    const fileEditor = container.querySelector('textarea')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(fileEditor, '# Committed\n')
      fileEditor.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Changes"]')!.click(),
    )
    const commitButton = button('Commit 1 file')
    expect(commitButton.disabled).toBe(true)
    const commitMessage = container.querySelector<HTMLTextAreaElement>('[aria-label="Commit message"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(commitMessage, 'Rename story heading')
      commitMessage.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => button('Commit 1 file').click())
    const committedDraft = readWorkspaceDraft('us-109')
    expect(committedDraft.drafts).toEqual({})
    expect(committedDraft.commits).toHaveLength(1)
    expect(committedDraft.commits[0]).toMatchObject({
      message: 'Rename story heading',
      files: { 'README.md': '# Committed\n' },
    })
    expect(container.querySelector('[aria-label="Changes"]')?.textContent).toBe('')
    expect(container.querySelector('[aria-label="Local commits"]')?.textContent).toContain('Rename story heading')
    expect(commitMessage.value).toBe('')
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Files"]')!.click(),
    )
    expect(container.querySelector('textarea')?.value).toBe('# Committed\n')
  } finally {
    await act(async () => root.unmount())
    store.dispatch(atlasApi.util.resetApiState())
    container.remove()
    localStorage.clear()
    vi.unstubAllGlobals()
  }
})

it('commits only the checked changed files', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  localStorage.setItem(
    workspaceStorageKey('us-109'),
    JSON.stringify({
      drafts: { 'README.md': '# One\n', 'backend/README.md': '# Two\n' },
      saved: {},
      commits: [],
    }),
  )
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const store = createAppStore()
  const button = (label: string) =>
    [...document.querySelectorAll('button')].find(
      (item) => item.textContent === label,
    )!
  const query = (selector: string) =>
    container.querySelector<HTMLElement>(selector)!
  try {
    await act(async () => {
      root.render(
        <Provider store={store}>
          <MemoryRouter initialEntries={['/editor?us=us-109']}>
            <EditorPage />
          </MemoryRouter>
        </Provider>,
      )
      await store.dispatch(atlasApi.endpoints.getStories.initiate()).unwrap()
    })
    await act(async () => query('[aria-label="Changes"]').click())
    expect(button('Commit 2 files')).toBeTruthy()
    await act(async () =>
      query('[aria-label="Include backend/README.md in commit"]').click(),
    )
    expect(query('[aria-label="Changed files"]').textContent).toContain('1 of 2 selected')
    const commitMessage = query('[aria-label="Commit message"]') as HTMLTextAreaElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(commitMessage, 'Only the story README')
      commitMessage.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => button('Commit 1 file').click())
    const draft = readWorkspaceDraft('us-109')
    expect(draft.commits.map((commit) => commit.files)).toEqual([
      { 'README.md': '# One\n' },
    ])
    expect(draft.drafts).toEqual({ 'backend/README.md': '# Two\n' })
    expect(query('[aria-label="Changes"]').textContent).toBe('1')
    expect(
      (query('[aria-label="Include backend/README.md in commit"]') as HTMLElement).getAttribute('aria-checked'),
    ).toBe('false')
  } finally {
    await act(async () => root.unmount())
    store.dispatch(atlasApi.util.resetApiState())
    container.remove()
    localStorage.clear()
    vi.unstubAllGlobals()
  }
})

it('recovers from malformed stored drafts without loading non-string file contents', () => {
  localStorage.setItem(workspaceStorageKey('invalid'), '{')
  expect(readWorkspaceDraft('invalid')).toEqual({
    drafts: {},
    saved: {},
    commits: [],
  })
  localStorage.setItem(
    workspaceStorageKey('invalid'),
    JSON.stringify({
      drafts: { 'a.ts': 42, 'b.ts': 'code' },
      saved: null,
      commits: [
        { id: 'abc1234', message: 'Fix', createdAt: '2026-10-22', files: { 'c.ts': 1, 'd.ts': 'd' } },
        { id: 7, message: 'Broken' },
      ],
    }),
  )
  expect(readWorkspaceDraft('invalid')).toEqual({
    drafts: { 'b.ts': 'code' },
    saved: {},
    commits: [
      { id: 'abc1234', message: 'Fix', createdAt: '2026-10-22', files: { 'd.ts': 'd' } },
    ],
  })
  localStorage.removeItem(workspaceStorageKey('invalid'))
})
