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
    expect(container.querySelector('file-tree-container')?.shadowRoot?.querySelector('[data-item-path="README.md"]')?.getAttribute('data-item-git-status')).toBe('modified')
    await act(async () => button('Save locally').click())
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
    await act(async () => button('Changes1').click())
    expect(
      container.querySelector('[aria-label="Changes in README.md"]')
        ?.textContent,
    ).toContain('# Edited story')
    await act(async () => button('Review & merge').click())
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      '1 changed file',
    )
    expect(
      document.querySelector('[role="dialog"] a')?.getAttribute('href'),
    ).toContain('/merge_requests/42')
    await act(async () => button('Continue editing').click())
    await act(async () => button('Changes1').click())
    const previousSession = container.querySelector('textarea')?.dataset.editStateKey
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Discard file changes"]')!.click())
    await act(async () => button('Discard changes').click())
    expect(container.querySelector('textarea')?.value).toContain('US-109')
    expect(container.querySelector('textarea')?.dataset.editStateKey).not.toBe(previousSession)
    expect(readWorkspaceDraft('us-109')).toEqual({ drafts: {}, saved: {} })
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
  expect(readWorkspaceDraft('invalid')).toEqual({ drafts: {}, saved: {} })
  localStorage.setItem(
    workspaceStorageKey('invalid'),
    JSON.stringify({ drafts: { 'a.ts': 42, 'b.ts': 'code' }, saved: null }),
  )
  expect(readWorkspaceDraft('invalid')).toEqual({
    drafts: { 'b.ts': 'code' },
    saved: {},
  })
  localStorage.removeItem(workspaceStorageKey('invalid'))
})
