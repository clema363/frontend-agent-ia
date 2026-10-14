import {
  computed,
  reactive,
  toRefs,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import type { Me, NewConnection, SourceTool } from "@/lib/domain";
import { stageForColumn } from "@/lib/story-workflow";
import { api } from "./endpoints";

type Getter<T> = MaybeRefOrGetter<T>;
function read<T>(
  key: string,
  fn: () => Promise<T>,
  enabled: Getter<boolean> = true,
) {
  return reactive(
    useQuery({
      queryKey: [key],
      queryFn: fn,
      enabled: computed(() => toValue(enabled)),
    }),
  );
}
function scoped<T, A>(
  key: string,
  arg: Getter<A>,
  fn: (arg: A) => Promise<T>,
  enabled: Getter<boolean> = true,
) {
  return reactive(
    useQuery({
      queryKey: computed(() => [key, toValue(arg)]),
      queryFn: () => fn(toValue(arg)),
      enabled: computed(() => toValue(enabled)),
    }),
  );
}
function write<T, A>(fn: (arg: A) => Promise<T>, keys: string[]) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        keys.map((key) => client.invalidateQueries({ queryKey: [key] })),
      ),
  });
  // Event handlers that fire a mutation without awaiting it still expose the error through the mutation state.
  const trigger = (arg: A) => {
    const promise = mutation.mutateAsync(arg);
    void promise.catch(() => undefined);
    return promise;
  };
  return reactive({ ...mutation, isLoading: mutation.isPending, trigger });
}
export const useMe = () => read("Me", api.auth.me);
export const useHealth = () => read("Health", api.health);
export const useStats = () => read("Stats", api.us.stats);
export const useProjects = () => read("Projects", api.projects.list);
export const useSettings = () => read("Settings", api.settings.get);
export const useUsers = (enabled: Getter<boolean> = true) =>
  read("Users", api.users.list, enabled);
export const useJournal = (id: Getter<string | undefined> = undefined) =>
  scoped("Journal", id, api.us.journal);
export const useConnections = (tool: Getter<SourceTool>) =>
  scoped("Connections", tool, api.connections.list);
export const useJiraProjects = (enabled: Getter<boolean>) =>
  read("JiraProjects", api.jira.projects, enabled);
export const useConfluenceSpaces = (enabled: Getter<boolean>) =>
  read("ConfluenceSpaces", api.confluence.spaces, enabled);
export const useGitlabProjects = (enabled: Getter<boolean>) =>
  read("GitlabProjects", api.gitlab.projects, enabled);
export const useMembers = (id: Getter<string>, enabled: Getter<boolean>) =>
  scoped("Members", id, api.projects.members, enabled);
export const useProjectContext = (
  id: Getter<string>,
  enabled: Getter<boolean>,
) => scoped("Context", id, api.projects.context, enabled);
export const useFieldConfig = (id: Getter<string>, enabled: Getter<boolean>) =>
  scoped("FieldConfig", id, api.projects.fieldConfig, enabled);
export function useStories() {
  return reactive(
    useQuery({
      queryKey: ["Stories"],
      queryFn: api.us.list,
      refetchInterval: (query) =>
        query.state.data?.some((story) => {
          const stage = stageForColumn(story.column);
          return stage && !story.stages[stage.id];
        })
          ? 2000
          : false,
    }),
  );
}
export const useUpdateMe = () =>
  write(api.auth.updateMe, [
    "Me",
    "Projects",
    "Stories",
    "Journal",
    "Stats",
    "Members",
    "Context",
    "FieldConfig",
    "Users",
    "Settings",
    "Health",
    "Connections",
    "JiraProjects",
    "ConfluenceSpaces",
    "GitlabProjects",
  ]);
export const useUpdateUser = () =>
  write(
    ({
      id,
      ...changes
    }: { id: string } & Parameters<typeof api.users.update>[1]) =>
      api.users.update(id, changes),
    ["Users", "Me", "Projects", "Members"],
  );
export function useTestAi() {
  const mutation = write(api.testAi, ["Health"]);
  return reactive({
    ...toRefs(mutation),
    trigger: () => mutation.trigger(undefined),
  });
}
export function useSavePreferences() {
  const client = useQueryClient();
  // Serialize preference writes so a failed request cannot undo a newer successful save.
  const mutation = useMutation({
    scope: { id: "preferences" },
    mutationFn: (changes: Record<string, unknown>) =>
      api.auth.updateMe({
        preferences: {
          ...client.getQueryData<Me>(["Me"])?.preferences,
          ...changes,
        },
      }),
    onMutate: async (changes) => {
      await client.cancelQueries({ queryKey: ["Me"] });
      const previous = client.getQueryData<Me>(["Me"]);
      if (previous)
        client.setQueryData<Me>(["Me"], {
          ...previous,
          preferences: { ...previous.preferences, ...changes },
        });
      return { previous };
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) client.setQueryData(["Me"], context.previous);
    },
    onSettled: () => {
      if (client.isMutating({ mutationKey: ["preferences"] }) === 1)
        return client.invalidateQueries({ queryKey: ["Me"] });
    },
    mutationKey: ["preferences"],
  });
  return reactive({
    ...mutation,
    isLoading: mutation.isPending,
    trigger: (changes: Record<string, unknown>) => {
      const promise = mutation.mutateAsync(changes);
      void promise.catch(() => undefined);
      return promise;
    },
  });
}
export function useStoryMutations() {
  return {
    create: write(api.us.create, ["Stories", "Projects", "Stats", "Journal"]),
    decide: write(
      ({ id, ...body }: { id: string } & Parameters<typeof api.us.decide>[1]) =>
        api.us.decide(id, body),
      ["Stories", "Projects", "Journal", "Stats"],
    ),
    sendMessage: write(
      ({ id, message }: { id: string; message: string }) =>
        api.us.sendMessage(id, message),
      ["Stories", "Journal"],
    ),
  };
}
export function useProjectMutations() {
  return {
    create: write(api.projects.create, ["Projects"]),
    patch: write(
      ({
        id,
        ...body
      }: { id: string } & Parameters<typeof api.projects.patch>[1]) =>
        api.projects.patch(id, body),
      ["Projects", "Context", "FieldConfig"],
    ),
    delete: write(api.projects.delete, [
      "Projects",
      "Stories",
      "Journal",
      "Members",
      "Context",
      "FieldConfig",
    ]),
  };
}
export function useMemberMutations(projectId: string) {
  return {
    invite: write(
      (body: Parameters<typeof api.projects.inviteMember>[1]) =>
        api.projects.inviteMember(projectId, body),
      ["Members", "Projects", "Users"],
    ),
    update: write(
      ({
        userId,
        roles,
      }: {
        userId: string;
        roles: Parameters<typeof api.projects.updateMember>[2];
      }) => api.projects.updateMember(projectId, userId, roles),
      ["Members", "Projects", "Users"],
    ),
    remove: write(
      (userId: string) => api.projects.removeMember(projectId, userId),
      ["Members", "Projects", "Users"],
    ),
  };
}
export function useContextMutations(projectId: string) {
  return {
    init: write(
      (kinds?: Parameters<typeof api.projects.initContext>[1]) =>
        api.projects.initContext(projectId, kinds),
      ["Context"],
    ),
    validate: write(
      (body: Parameters<typeof api.projects.validateContext>[1]) =>
        api.projects.validateContext(projectId, body),
      ["Context"],
    ),
  };
}
export const useSaveFieldConfig = (id: string) =>
  write(
    (body: Parameters<typeof api.projects.saveFieldConfig>[1]) =>
      api.projects.saveFieldConfig(id, body),
    ["FieldConfig"],
  );
export const useCreateConnection = (tool: SourceTool) =>
  write(
    (body: NewConnection) => api.connections.create(tool, body),
    ["Connections", "JiraProjects", "ConfluenceSpaces", "GitlabProjects"],
  );
export const useDeleteConnection = (tool: SourceTool) =>
  write(
    (id: string) => api.connections.delete(tool, id),
    ["Connections", "JiraProjects", "ConfluenceSpaces", "GitlabProjects"],
  );
