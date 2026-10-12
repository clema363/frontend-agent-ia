import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../src/api/endpoints'
import { atlasApi } from '../src/api/rtk-api'
import { useMe, useStories, useUpdateMe } from '../src/api/hooks'
import { createAppStore } from '../src/lib/store'
import type { Me, UserStory } from '../src/lib/domain'

const account: Me = { id: 'u-test', name: 'Test User', email: 'test@example.com', isAdmin: false, isActive: true, role: 'PO' }
const workingStory: UserStory = { id: 'us-test', key: 'US-1', type: 'Story', title: 'Test', priority: 'Medium', projectId: 'p-test', column: 'to-author', raw: 'Test', contextLinks: [], stages: {} }
let store: ReturnType<typeof createAppStore>
let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  store = createAppStore()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  store.dispatch(atlasApi.util.resetApiState())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('updates both account consumers after a role change through the domain hook', async () => {
  const getMe = vi.spyOn(api.auth, 'me').mockResolvedValue(account)
  vi.spyOn(api.auth, 'updateMe').mockResolvedValue({ ...account, role: 'DEV' })
  function Consumer() {
    const me = useMe()
    const update = useUpdateMe()
    return createElement('button', { onClick: () => { void update.trigger({ role: 'DEV' }) } }, me.data?.role ?? 'Loading')
  }
  await act(async () => {
    root.render(<Provider store={store}><div><Consumer /><Consumer /></div></Provider>)
  })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
  expect(container.textContent).toBe('POPO')
  expect(getMe).toHaveBeenCalledTimes(1)
  getMe.mockResolvedValue({ ...account, role: 'DEV' })
  await act(async () => { container.querySelector('button')!.click() })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)) })
  expect(container.textContent).toBe('DEVDEV')
})

it('polls working agents through shared subscriptions and stops when the work ends', async () => {
  vi.useFakeTimers()
  const getStories = vi.spyOn(api.us, 'list').mockResolvedValue([workingStory])
  function Consumer() {
    const stories = useStories()
    return createElement('span', null, stories.data?.[0]?.column ?? 'Loading')
  }
  await act(async () => {
    root.render(<Provider store={store}><div><Consumer /><Consumer /></div></Provider>)
  })
  await act(async () => { await vi.advanceTimersByTimeAsync(120) })
  expect(getStories).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(2200) })
  expect(getStories).toHaveBeenCalledTimes(2)
  getStories.mockResolvedValue([{ ...workingStory, column: 'sent-to-ai' }])
  await act(async () => { await vi.advanceTimersByTimeAsync(2200) })
  expect(getStories).toHaveBeenCalledTimes(3)
  expect(container.textContent).toBe('sent-to-aisent-to-ai')
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
  expect(getStories).toHaveBeenCalledTimes(3)
})
