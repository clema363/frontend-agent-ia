import { defineComponent, h, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "@/api/endpoints";
import {
  useMe,
  useProjects,
  useJournal,
  useUsers,
  useSavePreferences,
  useProjectMutations,
  useUpdateMe,
} from "@/api/hooks";
import { ApiError } from "@/api/client";
import type { Me } from "@/lib/domain";
const clients: QueryClient[] = [];
const wrappers: ReturnType<typeof mount>[] = [];
function harness<T>(
  setup: () => T,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  let result!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  );
  clients.push(client);
  wrappers.push(wrapper);
  return { result, client };
}
async function settle() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushPromises();
}
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});
it("shares cached account data between mounted Vue consumers", async () => {
  const account = {
    id: "me",
    name: "Test",
    email: "test@example.com",
    role: "PO",
    isAdmin: true,
    isActive: true,
    preferences: {},
  } as Me;
  const fetch = vi.spyOn(api.auth, "me").mockResolvedValue(account);
  const first = harness(useMe);
  const second = harness(useMe, first.client);
  await settle();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(first.result.data?.name).toBe("Test");
  expect(second.result.data?.name).toBe("Test");
});
it("enables administrator data when the asynchronous account becomes available", async () => {
  const enabled = ref(false);
  const fetch = vi.spyOn(api.users, "list").mockResolvedValue([]);
  const { result } = harness(() => useUsers(() => enabled.value));
  await settle();
  expect(fetch).not.toHaveBeenCalled();
  enabled.value = true;
  await settle();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.data).toEqual([]);
});
it("changes scoped query keys when the story changes", async () => {
  const id = ref("us-118");
  const fetch = vi.spyOn(api.us, "journal").mockResolvedValue([]);
  const { client } = harness(() => useJournal(() => id.value));
  await settle();
  id.value = "us-109";
  await settle();
  expect(fetch).toHaveBeenCalledWith("us-118");
  expect(fetch).toHaveBeenCalledWith("us-109");
  expect(client.getQueryData(["Journal", "us-109"])).toEqual([]);
});
it("refreshes the project list after creation", async () => {
  const initial = {
    id: "initial",
    name: "Initial",
    key: "INITIAL",
    myRoles: [],
    memberCount: 0,
    userStories: 0,
    completed: 0,
  };
  const created = { ...initial, id: "new", name: "New", key: "NEW" };
  const fetch = vi
    .spyOn(api.projects, "list")
    .mockResolvedValueOnce([initial])
    .mockResolvedValue([initial, created]);
  vi.spyOn(api.projects, "create").mockResolvedValue(created);
  const { result } = harness(() => ({
    projects: useProjects(),
    mutations: useProjectMutations(),
  }));
  await settle();
  await result.mutations.create.trigger({ name: "New", key: "NEW" });
  await settle();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(result.projects.data?.map((project) => project.id)).toEqual([
    "initial",
    "new",
  ]);
});
it("invalidates permission dependent data after changing the role", async () => {
  const account = {
    id: "me",
    name: "Test",
    email: "test@example.com",
    role: "PO",
    isAdmin: true,
    isActive: true,
    preferences: {},
  } as Me;
  vi.spyOn(api.auth, "me")
    .mockResolvedValueOnce(account)
    .mockResolvedValue({ ...account, role: "DEV" });
  vi.spyOn(api.auth, "updateMe").mockResolvedValue({ ...account, role: "DEV" });
  const projects = vi.spyOn(api.projects, "list").mockResolvedValue([]);
  const { result } = harness(() => ({
    me: useMe(),
    projects: useProjects(),
    update: useUpdateMe(),
  }));
  await settle();
  await result.update.trigger({ role: "DEV" });
  await settle();
  expect(result.me.data?.role).toBe("DEV");
  expect(projects).toHaveBeenCalledTimes(2);
});
it("optimistically updates preferences and restores them after failure", async () => {
  const account = {
    id: "me",
    name: "Test",
    email: "test@example.com",
    role: "PO",
    isAdmin: true,
    isActive: true,
    preferences: { kanbanView: "board", other: "preserved" },
  } as Me;
  let reject!: (cause: Error) => void;
  vi.spyOn(api.auth, "me").mockResolvedValue(account);
  vi.spyOn(api.auth, "updateMe").mockImplementation(
    () =>
      new Promise((_resolve, rejectPromise) => {
        reject = rejectPromise;
      }),
  );
  const { result, client } = harness(() => ({
    me: useMe(),
    save: useSavePreferences(),
  }));
  await settle();
  const saving = result.save.trigger({ kanbanView: "list" });
  await settle();
  expect(client.getQueryData<Me>(["Me"])?.preferences.kanbanView).toBe("list");
  reject(new ApiError(500, "Save failed"));
  await expect(saving).rejects.toThrow("Save failed");
  await settle();
  expect(result.me.data?.preferences).toEqual(account.preferences);
  expect(result.save.isError).toBe(true);
});
