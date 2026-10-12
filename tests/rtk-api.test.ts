import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/api/endpoints'
import { ApiError } from '../src/api/client'
import { atlasApi, toApiError } from '../src/api/rtk-api'
import { createAppStore } from '../src/lib/store'
import type { Me } from '../src/lib/domain'

const account: Me = { id: 'u-test', name: 'Test User', email: 'test@example.com', isAdmin: true, isActive: true, role: 'PO', preferences: { existing: true } }
let store: ReturnType<typeof createAppStore>

beforeEach(() => { store = createAppStore() })
afterEach(() => {
  store.dispatch(atlasApi.util.resetApiState())
  vi.restoreAllMocks()
})

describe('Redux API cache', () => {
  it('shares one request and cache between subscribers', async () => {
    const request = vi.spyOn(api.auth, 'me').mockResolvedValue(account)
    const first = store.dispatch(atlasApi.endpoints.getMe.initiate())
    const second = store.dispatch(atlasApi.endpoints.getMe.initiate())
    await Promise.all([first.unwrap(), second.unwrap()])
    expect(request).toHaveBeenCalledTimes(1)
    expect(atlasApi.endpoints.getMe.select()(store.getState()).data).toEqual(account)
    first.unsubscribe()
    second.unsubscribe()
  })

  it('refreshes active project lists after creating a project in the demo backend', async () => {
    const subscription = store.dispatch(atlasApi.endpoints.getProjects.initiate())
    const before = await subscription.unwrap()
    const created = await store.dispatch(atlasApi.endpoints.createProject.initiate({ name: 'Redux integration', key: 'RTK' })).unwrap()
    await vi.waitFor(() => {
      const projects = atlasApi.endpoints.getProjects.select()(store.getState()).data
      expect(projects).toHaveLength(before.length + 1)
      expect(projects?.find((project) => project.id === created.id)?.name).toBe('Redux integration')
    })
    subscription.unsubscribe()
  })

  it('refreshes the account and permission-dependent queries after a role change', async () => {
    const getMe = vi.spyOn(api.auth, 'me').mockResolvedValue(account)
    const getStories = vi.spyOn(api.us, 'list').mockResolvedValue([])
    const getProjects = vi.spyOn(api.projects, 'list').mockResolvedValue([])
    const update = vi.spyOn(api.auth, 'updateMe').mockResolvedValue({ ...account, role: 'DEV' })
    const subscriptions = [
      store.dispatch(atlasApi.endpoints.getMe.initiate()),
      store.dispatch(atlasApi.endpoints.getStories.initiate()),
      store.dispatch(atlasApi.endpoints.getProjects.initiate()),
    ]
    await Promise.all(subscriptions.map((query) => query.unwrap()))
    getMe.mockResolvedValue({ ...account, role: 'DEV' })
    await store.dispatch(atlasApi.endpoints.updateMe.initiate({ role: 'DEV' })).unwrap()
    await vi.waitFor(() => {
      expect(atlasApi.endpoints.getMe.select()(store.getState()).data?.role).toBe('DEV')
      expect(getStories).toHaveBeenCalledTimes(2)
      expect(getProjects).toHaveBeenCalledTimes(2)
    })
    expect(update).toHaveBeenCalledWith({ role: 'DEV' })
    subscriptions.forEach((query) => query.unsubscribe())
  })

  it('refreshes members for the changed project only', async () => {
    const getMembers = vi.spyOn(api.projects, 'members').mockResolvedValue([])
    vi.spyOn(api.projects, 'list').mockResolvedValue([])
    vi.spyOn(api.users, 'list').mockResolvedValue([])
    vi.spyOn(api.projects, 'inviteMember').mockResolvedValue({ userId: 'u-new', name: 'New user', email: 'new@example.com', roles: ['BA'] })
    const first = store.dispatch(atlasApi.endpoints.getMembers.initiate('p-one'))
    const second = store.dispatch(atlasApi.endpoints.getMembers.initiate('p-two'))
    await Promise.all([first.unwrap(), second.unwrap()])
    await store.dispatch(atlasApi.endpoints.inviteMember.initiate({ projectId: 'p-one', email: 'new@example.com', roles: ['BA'] })).unwrap()
    await vi.waitFor(() => expect(getMembers).toHaveBeenCalledTimes(3))
    expect(getMembers.mock.calls.filter(([id]) => id === 'p-two')).toHaveLength(1)
    first.unsubscribe()
    second.unsubscribe()
  })

  it('merges preferences optimistically and restores them if saving fails', async () => {
    vi.spyOn(api.auth, 'me').mockResolvedValue(account)
    let rejectSave!: (cause: Error) => void
    const update = vi.spyOn(api.auth, 'updateMe').mockImplementation(() => new Promise((_resolve, reject) => { rejectSave = reject }))
    const subscription = store.dispatch(atlasApi.endpoints.getMe.initiate())
    await subscription.unwrap()
    const saving = store.dispatch(atlasApi.endpoints.savePreferences.initiate({ kanbanView: 'list' }))
    expect(atlasApi.endpoints.getMe.select()(store.getState()).data?.preferences).toEqual({ existing: true, kanbanView: 'list' })
    expect(update).toHaveBeenCalledWith({ preferences: { existing: true, kanbanView: 'list' } })
    rejectSave(new ApiError(503, 'Service unavailable'))
    await expect(saving.unwrap()).rejects.toEqual({ status: 503, message: 'Service unavailable' })
    await vi.waitFor(() => expect(atlasApi.endpoints.getMe.select()(store.getState()).data?.preferences).toEqual({ existing: true }))
    subscription.unsubscribe()
  })

  it('keeps duplicate errors serializable and preserves the 409 confirmation details', async () => {
    const message = JSON.stringify({ detail: { duplicates: ['US-1'] } })
    vi.spyOn(api.us, 'create').mockRejectedValue(new ApiError(409, message))
    const creating = store.dispatch(atlasApi.endpoints.createStory.initiate({ need: 'Duplicate', project: 'p-one', priority: 'Medium' }))
    await expect(creating.unwrap()).rejects.toEqual({ status: 409, message })
    const result = await creating
    expect('error' in result && result.error).not.toBeInstanceOf(Error)
    if ('error' in result) {
      const error = toApiError(result.error)
      expect(error.status).toBe(409)
      expect(error.detail).toEqual({ duplicates: ['US-1'] })
    }
  })
})
