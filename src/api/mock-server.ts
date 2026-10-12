// Faux backend minimal : il répond aux routes du FastAPI avec les fixtures JSON (snake_case)
// et garde les modifications en mémoire pour que l'écran réagisse. Aucune règle métier :
// droits, doublons et validations restent le travail du vrai backend.
// Un rechargement de la page remet les données à zéro.
import type { AppUser, Connection, ContextMap, FieldConfig, JournalEntry, Me, Project, ProjectMember, Settings, SourceTool, UserStory } from '@/lib/domain'
import { nextColumn, stageForColumn } from '@/lib/story-workflow'
import { ApiError, toCamel, toSnake, type Method } from './client'
import confluencePages from './fixtures/confluence-pages.json'
import confluenceSpaces from './fixtures/confluence-spaces.json'
import connections from './fixtures/connections.json'
import context from './fixtures/context.json'
import demoAccounts from './fixtures/demo-accounts.json'
import fieldConfig from './fixtures/field-config.json'
import gitlabProjects from './fixtures/gitlab-projects.json'
import health from './fixtures/health.json'
import issueTypes from './fixtures/issue-types.json'
import jiraProjects from './fixtures/jira-projects.json'
import jiraSuggestions from './fixtures/jira-suggestions.json'
import journal from './fixtures/journal.json'
import me from './fixtures/me.json'
import projectMembers from './fixtures/project-members.json'
import projects from './fixtures/projects.json'
import settings from './fixtures/settings.json'
import stats from './fixtures/stats.json'
import us from './fixtures/us.json'
import users from './fixtures/users.json'

const LATENCY = 250

// Copie de travail des fixtures, en camelCase pour les handlers.
const db = toCamel(structuredClone({ us, journal, projects, projectMembers, users, me, context, fieldConfig, settings, connections })) as {
  us: UserStory[]
  journal: JournalEntry[]
  projects: Project[]
  projectMembers: Record<string, ProjectMember[]>
  users: AppUser[]
  me: Me
  context: Record<string, ContextMap[]>
  fieldConfig: Record<string, FieldConfig>
  settings: Settings
  connections: (Connection & { tool: SourceTool })[]
}

type Handler = (params: Record<string, string>, body: any) => unknown

let counter = 0
const newId = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`

function find<T>(list: T[], predicate: (item: T) => boolean): T {
  const item = list.find(predicate)
  if (!item) throw new ApiError(404, JSON.stringify({ detail: 'Not found' }))
  return item
}

const story = (id: string) => find(db.us, (item) => item.id === id)
const members = (projectId: string) => (db.projectMembers[projectId] ??= [])
const contextOf = (projectId: string) => (db.context[projectId] ??= structuredClone(db.context['p-6804']))
const fieldConfigOf = (projectId: string) => (db.fieldConfig[projectId] ??= structuredClone(db.fieldConfig['p-6804']))

// Trace d'une action de l'utilisateur connecté, pour le journal et les commentaires du panneau.
function log(item: UserStory, action: string, detail?: string) {
  const stage = stageForColumn(item.column)
  db.journal.push({ id: newId('j'), usId: item.id, at: new Date().toISOString(), actor: db.me.name, actorType: 'user', action, stage: stage?.id, detail })
}

// Remplace l'agent : le document de l'étape courante apparaît tout de suite.
function fillCurrentStage(item: UserStory) {
  const stage = stageForColumn(item.column)
  if (!stage || item.stages[stage.id]) return
  item.stages[stage.id] = { markdown: `## ${item.title}\n\n_Mock document (${stage.agent})._\n\n${item.raw}`, sources: [], chat: [] }
}

function currentOutput(item: UserStory) {
  const stage = stageForColumn(item.column)
  const output = stage && item.stages[stage.id]
  if (!output) throw new ApiError(409, JSON.stringify({ detail: 'No document yet' }))
  return output
}

const connectionRoutes = (tool: SourceTool, prefix: string): Record<string, Handler> => ({
  [`GET ${prefix}/connections`]: () => db.connections.filter((connection) => connection.tool === tool),
  [`POST ${prefix}/connections`]: (_, body: { siteUrl: string; displayName?: string }) => {
    const connection = { id: newId('c'), tool, siteUrl: body.siteUrl, displayName: body.displayName }
    db.connections.push(connection)
    return connection
  },
  [`DELETE ${prefix}/connections/{connection_id}`]: ({ connection_id }) => {
    db.connections = db.connections.filter((connection) => connection.id !== connection_id)
  },
})

const routes: Record<string, Handler> = {
  'GET /health': () => health,
  'GET /health-db': () => ({ status: 'ok' }),
  'POST /ai/test': () => ({ ok: true, model: health.llm_model, latency_ms: 840 }),

  'GET /auth/sso/status': () => ({ enabled: false }),
  'GET /auth/me': () => db.me,
  'PATCH /auth/me': (_, changes) => Object.assign(db.me, changes),
  'GET /auth/demo/accounts': () => demoAccounts,
  'POST /auth/demo': () => ({ accessToken: 'mock-token', user: db.me }),

  'GET /us': () => db.us,
  'GET /us/journal': () => db.journal,
  'GET /us/stats': () => stats,
  'POST /us/precheck': () => ({ duplicates: [] }),
  'POST /us': (_, body: { need: string; project: string; priority: UserStory['priority']; issueTypeName?: string }) => {
    const number = Math.max(0, ...db.us.map((item) => Number(item.key.replace(/\D/g, '')))) + 1
    const created: UserStory = {
      id: `us-${number}`,
      key: `US-${number}`,
      type: (body.issueTypeName as UserStory['type']) ?? 'Story',
      title: body.need.split('\n')[0].slice(0, 80),
      priority: body.priority,
      projectId: body.project,
      column: 'to-author',
      raw: body.need,
      contextLinks: [],
      stages: {},
    }
    fillCurrentStage(created)
    db.us.unshift(created)
    return created
  },
  'GET /us/{us_id}': ({ us_id }) => story(us_id),
  'DELETE /us/{us_id}': ({ us_id }) => {
    db.us = db.us.filter((item) => item.id !== us_id)
  },
  'POST /us/{us_id}/submit': ({ us_id }) => story(us_id),
  'POST /us/{us_id}/decide': ({ us_id }, body: { decision: 'approve' | 'refuse'; comment?: string }) => {
    const item = story(us_id)
    const output = currentOutput(item)
    output.review = { decision: body.decision === 'approve' ? 'approved' : 'rejected', by: db.me.role }
    log(item, body.decision === 'approve' ? 'approved' : 'refused', body.comment)
    if (body.decision === 'approve') {
      item.column = nextColumn(item.column)
      fillCurrentStage(item)
      if (item.column === 'sent-to-ai') {
        item.codingAgent = { agent: 'Claude Code', status: 'queued', startedAt: new Date().toISOString(), activities: [] }
      }
    }
    return item
  },
  'POST /us/{us_id}/messages': ({ us_id }, body: { message: string }) => {
    const item = story(us_id)
    log(item, 'message', body.message)
    currentOutput(item).chat.push(
      { id: newId('m'), author: 'user', role: db.me.role, text: body.message },
      { id: newId('m'), author: 'agent', text: 'Mock reply.' },
    )
    return item
  },
  'POST /us/{us_id}/finalize': ({ us_id }) => story(us_id),
  'PUT /us/{us_id}/fields': ({ us_id }, body: { fields: Record<string, unknown> }) => Object.assign(story(us_id), { fields: body.fields }),
  'POST /us/{us_id}/jira/push': ({ us_id }, body: { dryRun?: boolean }) => ({
    dryRun: Boolean(body?.dryRun),
    jiraKey: body?.dryRun ? null : story(us_id).key,
  }),

  'GET /projects': () => db.projects,
  'POST /projects': (_, body: { key: string; name: string }) => {
    const project: Project = { id: newId('p'), ...body, memberCount: 1, myRoles: ['PO', 'BA', 'Architect', 'DEV', 'QA'], userStories: 0, completed: 0 }
    db.projects.push(project)
    return project
  },
  // null détache la source.
  'PATCH /projects/{project_id}': ({ project_id }, changes: Record<string, unknown>) => {
    const project = find(db.projects, (item) => item.id === project_id)
    for (const [key, value] of Object.entries(changes)) Object.assign(project, { [key]: value ?? undefined })
    return project
  },
  'DELETE /projects/{project_id}': ({ project_id }) => {
    db.projects = db.projects.filter((project) => project.id !== project_id)
  },
  'GET /projects/{project_id}/members': ({ project_id }) => members(project_id),
  'POST /projects/{project_id}/members': ({ project_id }, body: { email: string; roles: ProjectMember['roles'] }) => {
    const user = db.users.find((item) => item.email === body.email)
    const member = { userId: user?.id ?? newId('u'), name: user?.name ?? body.email, email: body.email, roles: body.roles }
    members(project_id).push(member)
    return member
  },
  'PATCH /projects/{project_id}/members/{user_id}': ({ project_id, user_id }, body) =>
    Object.assign(find(members(project_id), (member) => member.userId === user_id), body),
  'DELETE /projects/{project_id}/members/{user_id}': ({ project_id, user_id }) => {
    db.projectMembers[project_id] = members(project_id).filter((member) => member.userId !== user_id)
  },
  'GET /projects/{project_id}/context': ({ project_id }) => contextOf(project_id),
  'POST /projects/{project_id}/context/init': ({ project_id }, body: { kinds?: string[] }) => {
    for (const map of contextOf(project_id)) if (!body?.kinds || body.kinds.includes(map.kind)) map.validated = false
    return contextOf(project_id)
  },
  'POST /projects/{project_id}/context/validate': ({ project_id }, body: { kind: string; content?: string }) => {
    const map = find(contextOf(project_id), (item) => item.kind === body.kind)
    return Object.assign(map, { content: body.content ?? map.content, validated: true })
  },
  'GET /projects/{project_id}/jira/issue-types': () => issueTypes,
  'GET /projects/{project_id}/jira/fields': ({ project_id }) => fieldConfigOf(project_id).catalogue,
  'GET /projects/{project_id}/jira/field-config': ({ project_id }) => fieldConfigOf(project_id),
  'PUT /projects/{project_id}/jira/field-config': ({ project_id }, body) => Object.assign(fieldConfigOf(project_id), body),
  'GET /projects/{project_id}/jira/suggest/{kind}': ({ kind }) => jiraSuggestions[kind as keyof typeof jiraSuggestions] ?? [],

  ...connectionRoutes('Jira', '/jira'),
  'GET /jira/projects': () => jiraProjects,
  'POST /jira/projects/{project_id}/sync': () => ({ synced: 0 }),
  ...connectionRoutes('Confluence', '/confluence'),
  'GET /confluence/spaces': () => confluenceSpaces,
  'GET /confluence/pages': () => confluencePages,
  ...connectionRoutes('GitLab', '/gitlab'),
  'GET /gitlab/projects': () => gitlabProjects,

  'GET /users': () => db.users,
  'PATCH /users/{user_id}': ({ user_id }, changes) => Object.assign(find(db.users, (user) => user.id === user_id), changes),
  'GET /settings': () => db.settings,
  'PUT /settings': (_, changes) => Object.assign(db.settings, changes),
}

// Les routes statiques passent avant les routes paramétrées (/us/stats avant /us/{us_id}).
const compiled = Object.entries(routes)
  .map(([key, handler]) => {
    const [method, pattern] = key.split(' ')
    const names: string[] = []
    const source = pattern.replace(/\{(\w+)\}/g, (_, name: string) => {
      names.push(name)
      return '([^/]+)'
    })
    return { method, regex: new RegExp(`^${source}$`), names, handler }
  })
  .sort((a, b) => a.names.length - b.names.length)

export async function handleMock(method: Method, path: string, body?: unknown) {
  await new Promise((resolve) => window.setTimeout(resolve, LATENCY))
  const { pathname } = new URL(path, 'http://mock')
  for (const route of compiled) {
    const match = route.method === method && pathname.match(route.regex)
    if (!match) continue
    const params = Object.fromEntries(route.names.map((name, index) => [name, decodeURIComponent(match[index + 1])]))
    // Réponse renvoyée en snake_case, comme le vrai backend.
    return toSnake(structuredClone(route.handler(params, toCamel(body)) ?? null))
  }
  throw new ApiError(404, JSON.stringify({ detail: `Mock: no route for ${method} ${pathname}` }))
}
