import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import type { Me, NewConnection, SourceTool } from '@/lib/domain'
import type { RootState } from '@/lib/store'
import { api } from './endpoints'
import { ApiError } from './client'

// Redux stores plain error data; Error instances stay outside the store.
export type ApiFailure = { status: number | 'NETWORK_ERROR'; message: string }

export function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause
  if (typeof cause === 'object' && cause !== null && 'message' in cause) {
    const status = 'status' in cause && typeof cause.status === 'number' ? cause.status : 0
    return new ApiError(status, String(cause.message))
  }
  return new ApiError(0, 'The request failed. Please try again.')
}

async function execute<T>(request: () => Promise<T>): Promise<{ data: T } | { error: ApiFailure }> {
  try {
    return { data: await request() }
  } catch (cause) {
    const error = toApiError(cause)
    return { error: { status: error.status || 'NETWORK_ERROR', message: error.message } }
  }
}

const cacheTags = ['Me', 'Health', 'Stories', 'Journal', 'Stats', 'Projects', 'Members', 'Context', 'FieldConfig', 'Users', 'Settings', 'Connections', 'JiraProjects', 'ConfluenceSpaces', 'GitlabProjects'] as const

// Reuse the HTTP client for JWT handling, snake_case conversion and the demo backend.
export const atlasApi = createApi({
  reducerPath: 'atlasApi',
  baseQuery: fakeBaseQuery<ApiFailure>(),
  tagTypes: cacheTags,
  keepUnusedDataFor: 60,
  refetchOnMountOrArgChange: 60,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (build) => ({
    getMe: build.query<Awaited<ReturnType<typeof api.auth.me>>, void>({
      queryFn: () => execute(() => api.auth.me()),
      providesTags: ['Me'],
    }),
    getHealth: build.query<Awaited<ReturnType<typeof api.health>>, void>({
      queryFn: () => execute(() => api.health()),
      providesTags: ['Health'],
    }),
    getStories: build.query<Awaited<ReturnType<typeof api.us.list>>, void>({
      queryFn: () => execute(() => api.us.list()),
      providesTags: ['Stories'],
    }),
    getJournal: build.query<Awaited<ReturnType<typeof api.us.journal>>, string | undefined>({
      queryFn: (arg) => execute(() => api.us.journal(arg)),
      providesTags: ['Journal'],
    }),
    getStats: build.query<Awaited<ReturnType<typeof api.us.stats>>, void>({
      queryFn: () => execute(() => api.us.stats()),
      providesTags: ['Stats'],
    }),
    getProjects: build.query<Awaited<ReturnType<typeof api.projects.list>>, void>({
      queryFn: () => execute(() => api.projects.list()),
      providesTags: ['Projects'],
    }),
    getMembers: build.query<Awaited<ReturnType<typeof api.projects.members>>, string>({
      queryFn: (arg) => execute(() => api.projects.members(arg)),
      providesTags: (_result, _error, arg) => [{ type: 'Members', id: arg }],
    }),
    getContext: build.query<Awaited<ReturnType<typeof api.projects.context>>, string>({
      queryFn: (arg) => execute(() => api.projects.context(arg)),
      providesTags: (_result, _error, arg) => [{ type: 'Context', id: arg }],
    }),
    getFieldConfig: build.query<Awaited<ReturnType<typeof api.projects.fieldConfig>>, string>({
      queryFn: (arg) => execute(() => api.projects.fieldConfig(arg)),
      providesTags: (_result, _error, arg) => [{ type: 'FieldConfig', id: arg }],
    }),
    getUsers: build.query<Awaited<ReturnType<typeof api.users.list>>, void>({
      queryFn: () => execute(() => api.users.list()),
      providesTags: ['Users'],
    }),
    getSettings: build.query<Awaited<ReturnType<typeof api.settings.get>>, void>({
      queryFn: () => execute(() => api.settings.get()),
      providesTags: ['Settings'],
    }),
    getConnections: build.query<Awaited<ReturnType<typeof api.connections.list>>, SourceTool>({
      queryFn: (arg) => execute(() => api.connections.list(arg)),
      providesTags: (_result, _error, arg) => [{ type: 'Connections', id: arg }],
    }),
    getJiraProjects: build.query<Awaited<ReturnType<typeof api.jira.projects>>, void>({
      queryFn: () => execute(() => api.jira.projects()),
      providesTags: ['JiraProjects'],
    }),
    getConfluenceSpaces: build.query<Awaited<ReturnType<typeof api.confluence.spaces>>, void>({
      queryFn: () => execute(() => api.confluence.spaces()),
      providesTags: ['ConfluenceSpaces'],
    }),
    getGitlabProjects: build.query<Awaited<ReturnType<typeof api.gitlab.projects>>, void>({
      queryFn: () => execute(() => api.gitlab.projects()),
      providesTags: ['GitlabProjects'],
    }),
    updateMe: build.mutation<Awaited<ReturnType<typeof api.auth.updateMe>>, Parameters<typeof api.auth.updateMe>[0]>({
      queryFn: (arg) => execute(() => api.auth.updateMe(arg)),
      invalidatesTags: cacheTags,
    }),
    testAi: build.mutation<Awaited<ReturnType<typeof api.testAi>>, void>({
      queryFn: () => execute(() => api.testAi()),
      invalidatesTags: ['Health'],
    }),
    createStory: build.mutation<Awaited<ReturnType<typeof api.us.create>>, Parameters<typeof api.us.create>[0]>({
      queryFn: (arg) => execute(() => api.us.create(arg)),
      invalidatesTags: ['Stories', 'Projects', 'Stats', 'Journal'],
    }),
    decideStory: build.mutation<Awaited<ReturnType<typeof api.us.decide>>, { id: string } & Parameters<typeof api.us.decide>[1]>({
      queryFn: ({ id, ...body }) => execute(() => api.us.decide(id, body)),
      invalidatesTags: ['Stories', 'Projects', 'Journal', 'Stats'],
    }),
    sendMessage: build.mutation<Awaited<ReturnType<typeof api.us.sendMessage>>, { id: string; message: string }>({
      queryFn: (arg) => execute(() => api.us.sendMessage(arg.id, arg.message)),
      invalidatesTags: ['Stories', 'Journal'],
    }),
    createProject: build.mutation<Awaited<ReturnType<typeof api.projects.create>>, Parameters<typeof api.projects.create>[0]>({
      queryFn: (arg) => execute(() => api.projects.create(arg)),
      invalidatesTags: ['Projects'],
    }),
    patchProject: build.mutation<Awaited<ReturnType<typeof api.projects.patch>>, { id: string } & Parameters<typeof api.projects.patch>[1]>({
      queryFn: ({ id, ...body }) => execute(() => api.projects.patch(id, body)),
      invalidatesTags: ['Projects', 'Context', 'FieldConfig'],
    }),
    deleteProject: build.mutation<Awaited<ReturnType<typeof api.projects.delete>>, string>({
      queryFn: (arg) => execute(() => api.projects.delete(arg)),
      invalidatesTags: ['Projects', 'Stories', 'Journal', 'Members', 'Context', 'FieldConfig'],
    }),
    inviteMember: build.mutation<Awaited<ReturnType<typeof api.projects.inviteMember>>, { projectId: string } & Parameters<typeof api.projects.inviteMember>[1]>({
      queryFn: ({ projectId, ...body }) => execute(() => api.projects.inviteMember(projectId, body)),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Members', id: projectId }, 'Projects', 'Users'],
    }),
    updateMember: build.mutation<Awaited<ReturnType<typeof api.projects.updateMember>>, { projectId: string; userId: string; roles: Parameters<typeof api.projects.updateMember>[2] }>({
      queryFn: (arg) => execute(() => api.projects.updateMember(arg.projectId, arg.userId, arg.roles)),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Members', id: projectId }, 'Projects', 'Users'],
    }),
    removeMember: build.mutation<Awaited<ReturnType<typeof api.projects.removeMember>>, { projectId: string; userId: string }>({
      queryFn: (arg) => execute(() => api.projects.removeMember(arg.projectId, arg.userId)),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Members', id: projectId }, 'Projects', 'Users'],
    }),
    initContext: build.mutation<Awaited<ReturnType<typeof api.projects.initContext>>, { projectId: string; kinds?: Parameters<typeof api.projects.initContext>[1] }>({
      queryFn: (arg) => execute(() => api.projects.initContext(arg.projectId, arg.kinds)),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Context', id: projectId }],
    }),
    validateContext: build.mutation<Awaited<ReturnType<typeof api.projects.validateContext>>, { projectId: string } & Parameters<typeof api.projects.validateContext>[1]>({
      queryFn: ({ projectId, ...body }) => execute(() => api.projects.validateContext(projectId, body)),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Context', id: projectId }],
    }),
    saveFieldConfig: build.mutation<Awaited<ReturnType<typeof api.projects.saveFieldConfig>>, { projectId: string } & Parameters<typeof api.projects.saveFieldConfig>[1]>({
      queryFn: ({ projectId, ...body }) => execute(() => api.projects.saveFieldConfig(projectId, body)),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'FieldConfig', id: projectId }],
    }),
    updateUser: build.mutation<Awaited<ReturnType<typeof api.users.update>>, { id: string } & Parameters<typeof api.users.update>[1]>({
      queryFn: ({ id, ...body }) => execute(() => api.users.update(id, body)),
      invalidatesTags: ['Users', 'Me', 'Projects', 'Members'],
    }),
    createConnection: build.mutation<Awaited<ReturnType<typeof api.connections.create>>, { tool: SourceTool; body: NewConnection }>({
      queryFn: (arg) => execute(() => api.connections.create(arg.tool, arg.body)),
      invalidatesTags: (_result, _error, { tool }) => [{ type: 'Connections', id: tool }, 'JiraProjects', 'ConfluenceSpaces', 'GitlabProjects'],
    }),
    deleteConnection: build.mutation<Awaited<ReturnType<typeof api.connections.delete>>, { tool: SourceTool; id: string }>({
      queryFn: (arg) => execute(() => api.connections.delete(arg.tool, arg.id)),
      invalidatesTags: (_result, _error, { tool }) => [{ type: 'Connections', id: tool }, 'JiraProjects', 'ConfluenceSpaces', 'GitlabProjects'],
    }),
    savePreferences: build.mutation<Me, Record<string, unknown>>({
      queryFn: (changes, { getState }): Promise<{ data: Me } | { error: ApiFailure }> => {
        const me = atlasApi.endpoints.getMe.select()(getState() as RootState).data
        return execute(() => api.auth.updateMe({ preferences: { ...me?.preferences, ...changes } }))
      },
      async onQueryStarted(changes, { dispatch, queryFulfilled }) {
        const patch = dispatch(atlasApi.util.updateQueryData('getMe', undefined, (me) => {
          me.preferences = { ...me.preferences, ...changes }
        }))
        try {
          await queryFulfilled
        } catch {
          patch.undo()
          dispatch(atlasApi.util.invalidateTags(['Me']))
        }
      },
    }),
  }),
})
