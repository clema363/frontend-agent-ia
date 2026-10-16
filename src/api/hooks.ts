import type { NewConnection, OpencodeMessage, SourceTool, UserStory } from '@/lib/domain'
import { useAppSelector } from '@/lib/store'
import { stageForColumn } from '@/lib/story-workflow'
import { api } from './endpoints'
import { atlasApi } from './rtk-api'

// Domain hooks expose RTK Query results and mutation triggers to the screens.
function mutation<TTrigger, TState extends object>([trigger, state]: readonly [TTrigger, TState]) {
  return { ...state, trigger }
}

export const useMe = () => atlasApi.useGetMeQuery()
export const useUpdateMe = () => mutation(atlasApi.useUpdateMeMutation())
export const useSavePreferences = () => mutation(atlasApi.useSavePreferencesMutation())
export const useHealth = () => atlasApi.useGetHealthQuery()
export const useTestAi = () => mutation(atlasApi.useTestAiMutation())

const selectStories = atlasApi.endpoints.getStories.select()
const agentIsWorking = (story: UserStory) => {
  const stage = stageForColumn(story.column)
  return Boolean(stage && !story.stages[stage.id])
}

export function useStories() {
  const working = useAppSelector((state) => selectStories(state).data?.some(agentIsWorking) ?? false)
  return atlasApi.useGetStoriesQuery(undefined, { pollingInterval: working ? 2000 : 0 })
}

// OpenCode is working while its last assistant message has no completed time.
export const opencodeIsBusy = (messages: OpencodeMessage[] = []) => {
  const last = messages.at(-1)?.info
  return Boolean(last && (last.role === 'user' || !last.time.completed))
}

// Polls while OpenCode streams its answer; the backend could relay the /event SSE stream instead.
export function useOpencodeMessages(storyId: string, enabled: boolean) {
  const busy = useAppSelector((state) => opencodeIsBusy(atlasApi.endpoints.getOpencodeMessages.select(storyId)(state).data))
  const result = atlasApi.useGetOpencodeMessagesQuery(storyId, { skip: !enabled, pollingInterval: busy ? 500 : 0 })
  return { ...result, busy }
}

export function useOpencodeMutations() {
  return {
    send: mutation(atlasApi.useSendOpencodeMessageMutation()),
    abort: mutation(atlasApi.useAbortOpencodeMutation()),
  }
}

export const useJournal = (usId?: string) => atlasApi.useGetJournalQuery(usId)
export const useStats = () => atlasApi.useGetStatsQuery()
export const useProjects = () => atlasApi.useGetProjectsQuery()
export const useSettings = () => atlasApi.useGetSettingsQuery()
export const useUsers = (enabled = true) => atlasApi.useGetUsersQuery(undefined, { skip: !enabled })
export const useUpdateUser = () => mutation(atlasApi.useUpdateUserMutation())
export const useConnections = (tool: SourceTool) => atlasApi.useGetConnectionsQuery(tool)
export const useJiraProjects = (enabled: boolean) => atlasApi.useGetJiraProjectsQuery(undefined, { skip: !enabled })
export const useConfluenceSpaces = (enabled: boolean) => atlasApi.useGetConfluenceSpacesQuery(undefined, { skip: !enabled })
export const useGitlabProjects = (enabled: boolean) => atlasApi.useGetGitlabProjectsQuery(undefined, { skip: !enabled })
export const useMembers = (projectId: string, enabled: boolean) => atlasApi.useGetMembersQuery(projectId, { skip: !enabled })
export const useProjectContext = (projectId: string, enabled: boolean) => atlasApi.useGetContextQuery(projectId, { skip: !enabled })
export const useFieldConfig = (projectId: string, enabled: boolean) => atlasApi.useGetFieldConfigQuery(projectId, { skip: !enabled })

export function useStoryMutations() {
  return {
    create: mutation(atlasApi.useCreateStoryMutation()),
    decide: mutation(atlasApi.useDecideStoryMutation()),
    sendMessage: mutation(atlasApi.useSendMessageMutation()),
  }
}

export function useProjectMutations() {
  return {
    create: mutation(atlasApi.useCreateProjectMutation()),
    patch: mutation(atlasApi.usePatchProjectMutation()),
    delete: mutation(atlasApi.useDeleteProjectMutation()),
  }
}

export function useMemberMutations(projectId: string) {
  const invite = mutation(atlasApi.useInviteMemberMutation())
  const update = mutation(atlasApi.useUpdateMemberMutation())
  const remove = mutation(atlasApi.useRemoveMemberMutation())
  return {
    invite: { ...invite, trigger: (body: Parameters<typeof api.projects.inviteMember>[1]) => invite.trigger({ projectId, ...body }) },
    update: { ...update, trigger: (body: { userId: string; roles: Parameters<typeof api.projects.updateMember>[2] }) => update.trigger({ projectId, ...body }) },
    remove: { ...remove, trigger: (userId: string) => remove.trigger({ projectId, userId }) },
  }
}

export function useContextMutations(projectId: string) {
  const init = mutation(atlasApi.useInitContextMutation())
  const validate = mutation(atlasApi.useValidateContextMutation())
  return {
    init: { ...init, trigger: (kinds?: Parameters<typeof api.projects.initContext>[1]) => init.trigger({ projectId, kinds }) },
    validate: { ...validate, trigger: (body: Parameters<typeof api.projects.validateContext>[1]) => validate.trigger({ projectId, ...body }) },
  }
}

export function useSaveFieldConfig(projectId: string) {
  const save = mutation(atlasApi.useSaveFieldConfigMutation())
  return { ...save, trigger: (body: Parameters<typeof api.projects.saveFieldConfig>[1]) => save.trigger({ projectId, ...body }) }
}

export function useCreateConnection(tool: SourceTool) {
  const create = mutation(atlasApi.useCreateConnectionMutation())
  return { ...create, trigger: (body: NewConnection) => create.trigger({ tool, body }) }
}

export function useDeleteConnection(tool: SourceTool) {
  const remove = mutation(atlasApi.useDeleteConnectionMutation())
  return { ...remove, trigger: (id: string) => remove.trigger({ tool, id }) }
}
