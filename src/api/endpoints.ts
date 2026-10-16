// One function per FastAPI backend route (backend docs/api-routes.html or localhost:8000/docs).
// Request bodies use camelCase; client.ts converts them to snake_case.
import type {
  AppUser,
  ConfluencePage,
  ConfluenceSpace,
  Connection,
  ContextMap,
  ContextMapKind,
  FieldConfig,
  GitlabProject,
  Health,
  IssueTypeOption,
  JiraFieldGroup,
  JiraProject,
  JournalEntry,
  Me,
  NewConnection,
  NewStoryRequest,
  OpencodeMessage,
  Project,
  ProjectMember,
  ProjectSources,
  Role,
  Settings,
  SourceTool,
  Stats,
  SuggestKind,
  UserStory,
} from '@/lib/domain'
import { query, request } from './client'

const toolPrefix: Record<SourceTool, string> = { Jira: '/jira', Confluence: '/confluence', GitLab: '/gitlab' }

type Search = { q?: string; connectionId?: string }

export const api = {
  health: () => request<Health>('GET', '/health'),
  testAi: () => request<{ ok: boolean; model: string; latencyMs: number }>('POST', '/ai/test'),

  auth: {
    ssoStatus: () => request<{ enabled: boolean }>('GET', '/auth/sso/status'),
    me: () => request<Me>('GET', '/auth/me'),
    updateMe: (changes: { role?: Role; preferences?: Record<string, unknown> }) => request<Me>('PATCH', '/auth/me', changes),
    demoAccounts: () => request<{ email: string; name: string; role: Role }[]>('GET', '/auth/demo/accounts'),
    demoLogin: (body: { role?: Role; email?: string }) => request<{ accessToken: string; user: Me }>('POST', '/auth/demo', body),
  },

  us: {
    list: () => request<UserStory[]>('GET', '/us'),
    get: (id: string) => request<UserStory>('GET', `/us/${id}`),
    journal: (usId?: string) => request<JournalEntry[]>('GET', `/us/journal${query({ us_id: usId })}`),
    stats: () => request<Stats>('GET', '/us/stats'),
    precheck: (body: { need: string; project: string }) => request<{ duplicates: UserStory[] }>('POST', '/us/precheck', body),
    create: (body: NewStoryRequest) => request<UserStory>('POST', '/us', body),
    delete: (id: string, alsoInJira = false) => request<void>('DELETE', `/us/${id}${alsoInJira ? '?jira=true' : ''}`),
    submit: (id: string) => request<UserStory>('POST', `/us/${id}/submit`),
    // Rejection requires a comment.
    decide: (id: string, body: { decision: 'approve' | 'refuse'; comment?: string }) =>
      request<UserStory>('POST', `/us/${id}/decide`, body),
    sendMessage: (id: string, message: string) => request<UserStory>('POST', `/us/${id}/messages`, { message }),
    finalize: (id: string) => request<UserStory>('POST', `/us/${id}/finalize`),
    saveFields: (id: string, fields: Record<string, unknown>) => request<UserStory>('PUT', `/us/${id}/fields`, { fields }),
    pushToJira: (id: string, body: { dryRun?: boolean; attachArtifact?: boolean } = {}) =>
      request<{ dryRun: boolean; jiraKey: string | null }>('POST', `/us/${id}/jira/push`, body),
    // The backend proxies the story's OpenCode session (GET /session/{id}/message,
    // POST /session/{id}/prompt_async and POST /session/{id}/abort).
    opencodeMessages: (id: string) => request<OpencodeMessage[]>('GET', `/us/${id}/opencode/messages`),
    sendOpencodeMessage: (id: string, text: string) => request<void>('POST', `/us/${id}/opencode/messages`, { text }),
    abortOpencode: (id: string) => request<void>('POST', `/us/${id}/opencode/abort`),
  },

  projects: {
    list: () => request<Project[]>('GET', '/projects'),
    create: (body: { key: string; name: string; connectionId?: string }) => request<Project>('POST', '/projects', body),
    patch: (id: string, sources: ProjectSources) => request<Project>('PATCH', `/projects/${id}`, sources),
    delete: (id: string) => request<void>('DELETE', `/projects/${id}`),
    members: (id: string) => request<ProjectMember[]>('GET', `/projects/${id}/members`),
    // Create an account if the email address is unknown.
    inviteMember: (id: string, body: { email: string; roles: Role[] }) => request<ProjectMember>('POST', `/projects/${id}/members`, body),
    updateMember: (id: string, userId: string, roles: Role[]) =>
      request<ProjectMember>('PATCH', `/projects/${id}/members/${userId}`, { roles }),
    removeMember: (id: string, userId: string) => request<void>('DELETE', `/projects/${id}/members/${userId}`),
    context: (id: string) => request<ContextMap[]>('GET', `/projects/${id}/context`),
    initContext: (id: string, kinds?: ContextMapKind[]) => request<ContextMap[]>('POST', `/projects/${id}/context/init`, { kinds }),
    validateContext: (id: string, body: { kind: ContextMapKind; content?: string }) =>
      request<ContextMap>('POST', `/projects/${id}/context/validate`, body),
    issueTypes: (id: string) => request<IssueTypeOption[]>('GET', `/projects/${id}/jira/issue-types`),
    jiraFields: (id: string, issueTypeId?: string) =>
      request<JiraFieldGroup[]>('GET', `/projects/${id}/jira/fields${query({ issue_type_id: issueTypeId })}`),
    fieldConfig: (id: string) => request<FieldConfig>('GET', `/projects/${id}/jira/field-config`),
    saveFieldConfig: (id: string, body: Pick<FieldConfig, 'enabledFields' | 'priorityMapping'>) =>
      request<FieldConfig>('PUT', `/projects/${id}/jira/field-config`, body),
    jiraSuggest: (id: string, kind: SuggestKind, q?: string) =>
      request<string[]>('GET', `/projects/${id}/jira/suggest/${kind}${query({ q })}`),
  },

  connections: {
    list: (tool: SourceTool) => request<Connection[]>('GET', `${toolPrefix[tool]}/connections`),
    create: (tool: SourceTool, body: NewConnection) => request<Connection>('POST', `${toolPrefix[tool]}/connections`, body),
    delete: (tool: SourceTool, id: string) => request<void>('DELETE', `${toolPrefix[tool]}/connections/${id}`),
  },

  jira: {
    projects: ({ q, connectionId }: Search = {}) =>
      request<JiraProject[]>('GET', `/jira/projects${query({ q, connection_id: connectionId })}`),
    syncTickets: (projectId: string) => request<{ synced: number }>('POST', `/jira/projects/${projectId}/sync`),
  },

  confluence: {
    spaces: ({ q, connectionId }: Search = {}) =>
      request<ConfluenceSpace[]>('GET', `/confluence/spaces${query({ q, connection_id: connectionId })}`),
    pages: (spaceKey: string, { connectionId, limit }: { connectionId?: string; limit?: number } = {}) =>
      request<ConfluencePage[]>('GET', `/confluence/pages${query({ space_key: spaceKey, connection_id: connectionId, limit })}`),
  },

  gitlab: {
    projects: ({ q, connectionId }: Search = {}) =>
      request<GitlabProject[]>('GET', `/gitlab/projects${query({ q, connection_id: connectionId })}`),
  },

  users: {
    list: () => request<AppUser[]>('GET', '/users'),
    update: (id: string, changes: { isAdmin?: boolean; isActive?: boolean }) => request<AppUser>('PATCH', `/users/${id}`, changes),
  },

  settings: {
    get: () => request<Settings>('GET', '/settings'),
    save: (changes: Partial<Settings>) => request<Settings>('PUT', '/settings', changes),
  },
}
