import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { Me, NewConnection, SourceTool, UserStory } from '@/lib/domain'
import { stageForColumn } from '@/lib/story-workflow'
import { api } from './endpoints'

export const keys = {
  me: ['me'],
  health: ['health'],
  stories: ['us'],
  journal: ['us', 'journal'],
  stats: ['us', 'stats'],
  projects: ['projects'],
  members: (projectId: string) => ['projects', projectId, 'members'],
  context: (projectId: string) => ['projects', projectId, 'context'],
  fieldConfig: (projectId: string) => ['projects', projectId, 'field-config'],
  users: ['users'],
  settings: ['settings'],
  connections: (tool: SourceTool) => ['connections', tool],
  jiraProjects: ['jira-projects'],
  confluenceSpaces: ['confluence-spaces'],
  gitlabProjects: ['gitlab-projects'],
}

// Mutation qui rafraîchit les requêtes concernées une fois terminée.
function useInvalidatingMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>, ...invalidate: QueryKey[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

const agentIsWorking = (story: UserStory) => {
  const stage = stageForColumn(story.column)
  return Boolean(stage && !story.stages[stage.id])
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: api.auth.me })
}

// Changer de rôle métier change aussi ce que l'on peut valider : tout est rechargé.
export function useUpdateMe() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: api.auth.updateMe, onSettled: () => queryClient.invalidateQueries() })
}

// Préférences d'affichage (vue du Kanban…) : enregistrées sans tout recharger, contrairement au changement de rôle.
export function useSavePreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: Record<string, unknown>) => {
      const me = queryClient.getQueryData<Me>(keys.me)
      return api.auth.updateMe({ preferences: { ...me?.preferences, ...changes } })
    },
    onMutate: (changes) =>
      queryClient.setQueryData<Me>(keys.me, (me) => me && { ...me, preferences: { ...me.preferences, ...changes } }),
  })
}

export function useHealth() {
  return useQuery({ queryKey: keys.health, queryFn: api.health })
}

export function useTestAi() {
  return useMutation({ mutationFn: api.testAi })
}

export function useStories() {
  return useQuery({
    queryKey: keys.stories,
    queryFn: api.us.list,
    // Tant qu'un agent travaille, on interroge régulièrement pour voir apparaître son document.
    refetchInterval: (query) => (query.state.data?.some(agentIsWorking) ? 2000 : false),
  })
}

export function useJournal(usId?: string) {
  return useQuery({ queryKey: [...keys.journal, usId], queryFn: () => api.us.journal(usId) })
}

export function useStats() {
  return useQuery({ queryKey: keys.stats, queryFn: api.us.stats })
}

export function useStoryMutations() {
  return {
    create: useInvalidatingMutation(api.us.create, keys.stories, keys.projects),
    decide: useInvalidatingMutation(
      ({ id, ...body }: { id: string } & Parameters<typeof api.us.decide>[1]) => api.us.decide(id, body),
      keys.stories,
      keys.projects,
      keys.journal,
    ),
    sendMessage: useInvalidatingMutation(
      ({ id, message }: { id: string; message: string }) => api.us.sendMessage(id, message),
      keys.stories,
      keys.journal,
    ),
  }
}

export function useProjects() {
  return useQuery({ queryKey: keys.projects, queryFn: api.projects.list })
}

export function useProjectMutations() {
  return {
    create: useInvalidatingMutation(api.projects.create, keys.projects),
    patch: useInvalidatingMutation(
      ({ id, ...sources }: { id: string } & Parameters<typeof api.projects.patch>[1]) => api.projects.patch(id, sources),
      keys.projects,
    ),
    delete: useInvalidatingMutation(api.projects.delete, keys.projects),
  }
}

export function useMembers(projectId: string, enabled: boolean) {
  return useQuery({ queryKey: keys.members(projectId), queryFn: () => api.projects.members(projectId), enabled })
}

export function useMemberMutations(projectId: string) {
  const invalidate = [keys.members(projectId), keys.projects]
  return {
    invite: useInvalidatingMutation(
      (body: Parameters<typeof api.projects.inviteMember>[1]) => api.projects.inviteMember(projectId, body),
      ...invalidate,
    ),
    update: useInvalidatingMutation(
      ({ userId, roles }: { userId: string; roles: Parameters<typeof api.projects.updateMember>[2] }) =>
        api.projects.updateMember(projectId, userId, roles),
      ...invalidate,
    ),
    remove: useInvalidatingMutation((userId: string) => api.projects.removeMember(projectId, userId), ...invalidate),
  }
}

export function useProjectContext(projectId: string, enabled: boolean) {
  return useQuery({ queryKey: keys.context(projectId), queryFn: () => api.projects.context(projectId), enabled })
}

export function useContextMutations(projectId: string) {
  const key = keys.context(projectId)
  return {
    init: useInvalidatingMutation((kinds?: Parameters<typeof api.projects.initContext>[1]) => api.projects.initContext(projectId, kinds), key),
    validate: useInvalidatingMutation(
      (body: Parameters<typeof api.projects.validateContext>[1]) => api.projects.validateContext(projectId, body),
      key,
    ),
  }
}

export function useFieldConfig(projectId: string, enabled: boolean) {
  return useQuery({ queryKey: keys.fieldConfig(projectId), queryFn: () => api.projects.fieldConfig(projectId), enabled })
}

export function useSaveFieldConfig(projectId: string) {
  return useInvalidatingMutation(
    (body: Parameters<typeof api.projects.saveFieldConfig>[1]) => api.projects.saveFieldConfig(projectId, body),
    keys.fieldConfig(projectId),
  )
}

export function useUsers(enabled = true) {
  return useQuery({ queryKey: keys.users, queryFn: api.users.list, enabled })
}

export function useUpdateUser() {
  return useInvalidatingMutation(
    ({ id, ...changes }: { id: string } & Parameters<typeof api.users.update>[1]) => api.users.update(id, changes),
    keys.users,
  )
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: api.settings.get })
}

export function useConnections(tool: SourceTool) {
  return useQuery({ queryKey: keys.connections(tool), queryFn: () => api.connections.list(tool) })
}

export function useCreateConnection(tool: SourceTool) {
  return useInvalidatingMutation((body: NewConnection) => api.connections.create(tool, body), keys.connections(tool))
}

export function useDeleteConnection(tool: SourceTool) {
  return useInvalidatingMutation((id: string) => api.connections.delete(tool, id), keys.connections(tool))
}

export function useJiraProjects(enabled: boolean) {
  return useQuery({ queryKey: keys.jiraProjects, queryFn: () => api.jira.projects(), enabled })
}

export function useConfluenceSpaces(enabled: boolean) {
  return useQuery({ queryKey: keys.confluenceSpaces, queryFn: () => api.confluence.spaces(), enabled })
}

export function useGitlabProjects(enabled: boolean) {
  return useQuery({ queryKey: keys.gitlabProjects, queryFn: () => api.gitlab.projects(), enabled })
}
