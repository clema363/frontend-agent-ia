import { toApiError } from "@/api/errors";
import {
  useFieldConfig,
  useMe,
  useProjects,
  useStories,
  useStoryMutations,
} from "@/api/hooks";
import {
  ColumnIcon,
  IssueTypeIcon,
  PriorityIcon,
} from "@/components/kanban/issue-meta";
import {
  StoryDetail,
  type StoryActions,
} from "@/components/kanban/story-detail";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { kanbanColumns, type UserStory } from "@/lib/domain";
import { Link, useLocation, useParams } from "@/lib/router";
import { useQueryClient } from "@tanstack/vue-query";
import { ArrowLeft, FolderOpen, SquareKanban, Tag, User } from "@lucide/vue";
import { defineComponent, ref, type VNodeChild } from "vue";
export const StoryPage = defineComponent(
  (__props: Record<string, never>) => {
    const paramsState0 = useParams();

    const locationState1 = useLocation();

    const storiesState2 = useStories();

    const meState3 = useMe();

    const storyMutationsState4 = useStoryMutations();

    const queryClientState5 = useQueryClient();

    const error = ref<string | undefined>(undefined);
    const setError = (
      next:
        | string
        | undefined
        | ((current: string | undefined) => string | undefined),
    ) => {
      error.value =
        typeof next === "function"
          ? (next as (current: typeof error.value) => typeof error.value)(
              error.value,
            )
          : next;
    };
    return () => {
      const { storyId } = paramsState0;
      const location = locationState1;
      const { data: stories = [], isLoading, isError } = storiesState2;
      const { data: me } = meState3;
      const mutations = storyMutationsState4;
      const dispatch = queryClientState5;
      const story = stories.find((item) => item.id === storyId);
      const role = me?.role ?? "PO";
      const savedReturn = location.state?.returnTo;
      const returnTo =
        typeof savedReturn === "string" &&
        (savedReturn === "/kanban" || savedReturn.startsWith("/kanban?"))
          ? savedReturn
          : "/kanban";
      const onSuccess = () => setError(undefined);
      const onError = (cause: unknown) => setError(toApiError(cause).message);
      const actions: StoryActions = {
        onApprove: (id) => {
          void mutations.decide
            .trigger({ id, decision: "approve" })
            .then(onSuccess)
            .catch(onError);
        },
        onComment: (id, comment) => {
          void mutations.decide
            .trigger({ id, decision: "refuse", comment })
            .then(onSuccess)
            .catch(onError);
        },
        onChat: (id, message) => {
          void mutations.sendMessage
            .trigger({ id, message })
            .then(onSuccess)
            .catch(onError);
        },
        // Document edits remain local until a server save endpoint is available.
        onEdit: (id, stageId, markdown) => {
          dispatch.setQueryData<UserStory[]>(["Stories"], (list = []) =>
            list.map((item) => {
              if (item.id !== id || !item.stages[stageId]) return item;
              return {
                ...item,
                stages: {
                  ...item.stages,
                  [stageId]: {
                    ...item.stages[stageId],
                    markdown,
                    editedBy: role,
                    review: undefined,
                  },
                },
              };
            }),
          );
        },
      };
      return (
        <>
          <PageHeader
            title={story?.key ?? "Issue"}
            icon={SquareKanban}
            parent={{ label: "Kanban", to: returnTo }}
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link to={returnTo}>
                  <ArrowLeft data-icon="inline-start" />
                  Back to Kanban
                </Link>
              </Button>
            }
          />
          {error.value && (
            <Alert variant="destructive" class="mb-6">
              <AlertDescription>{error.value}</AlertDescription>
            </Alert>
          )}
          {isLoading ? (
            <p class="py-12 text-muted-foreground">Loading issue…</p>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Unable to load this issue. Please try again.
              </AlertDescription>
            </Alert>
          ) : !story ? (
            <div class="space-y-4 py-12">
              <p>Issue not found.</p>
              <Button variant="outline" asChild>
                <Link to="/kanban">
                  <ArrowLeft /> Back to Kanban
                </Link>
              </Button>
            </div>
          ) : (
            <div class="mx-auto grid max-w-7xl items-start gap-10 py-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16 lg:px-6 lg:py-10 xl:gap-24">
              <section class="min-w-0">
                <StoryDetail
                  key={`${story.id}-${story.column}`}
                  story={story}
                  role={role}
                  approving={mutations.decide.isLoading}
                  {...actions}
                />
              </section>
              <JiraProperties story={story} />
            </div>
          )}
        </>
      );
    };
  },
  { name: "StoryPage", props: [], inheritAttrs: false },
);
function fieldValue(value: unknown): string {
  if (value == null || value === "") return "Not set";
  if (Array.isArray(value))
    return value.length ? value.map(fieldValue).join(", ") : "Not set";
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    for (const key of ["displayName", "name", "label", "value", "key"]) {
      if (typeof item[key] === "string") return item[key];
    }
    return JSON.stringify(value);
  }
  return String(value);
}
const Property = defineComponent(
  (
    __props: {
      label: string;
      icon?: VNodeChild;
      children?: VNodeChild;
    },
    { slots },
  ) => {
    return () => {
      const { label, icon, children } = {
        ...__props,
        children: slots.default?.(),
      };
      return (
        <div class="space-y-1.5">
          <dt class="text-xs text-muted-foreground">{label}</dt>
          <dd class="flex items-start gap-2 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
            {icon}
            <span class="min-w-0 whitespace-pre-line break-words">
              {children}
            </span>
          </dd>
        </div>
      );
    };
  },
  { name: "Property", props: ["label", "icon"], inheritAttrs: false },
);
const JiraProperties = defineComponent(
  (__props: { story: UserStory }) => {
    const { story } = __props;
    const projectsState6 = useProjects();
    const fieldConfigState7 = useFieldConfig(
      () => story.projectId,
      () => true,
    );
    return () => {
      const { story } = __props;
      const { data: projects = [] } = projectsState6;
      const { data: config } = fieldConfigState7;
      const project = projects.find((item) => item.id === story.projectId);
      const fields = story.fields ?? {};
      const standardFields = new Set([
        "summary",
        "description",
        "status",
        "issuetype",
        "priority",
        "project",
        "assignee",
        "reporter",
        "labels",
        "parent",
        "epic-link",
      ]);
      const catalogue =
        config?.catalogue.flatMap((group) => group.fields) ?? [];
      const extraIds = new Set([
        ...catalogue
          .filter((field) => config?.enabledFields.includes(field.id))
          .map((field) => field.id),
        ...Object.keys(fields),
      ]);
      const extras = [...extraIds].filter((id) => !standardFields.has(id));
      return (
        <aside
          aria-label="Issue properties"
          class="space-y-8 border-t pt-6 lg:sticky lg:top-6 lg:border-t-0 lg:pt-2"
        >
          <section class="space-y-5">
            <h2 class="text-sm font-medium text-muted-foreground">
              Jira properties
            </h2>
            <dl class="space-y-5">
              <Property
                label="Issue type"
                icon={<IssueTypeIcon type={story.type} />}
              >
                {story.type}
              </Property>
              <Property label="Status">{fieldValue(fields.status)}</Property>
              <Property
                label="Priority"
                icon={<PriorityIcon priority={story.priority} />}
              >
                {fieldValue(fields.priority ?? story.priority)}
              </Property>
              <Property label="Assignee" icon={<User />}>
                {fields.assignee ? fieldValue(fields.assignee) : "Unassigned"}
              </Property>
              <Property label="Reporter" icon={<User />}>
                {fieldValue(fields.reporter)}
              </Property>
            </dl>
          </section>
          <section class="space-y-4">
            <h2 class="text-sm font-medium text-muted-foreground">
              Project & labels
            </h2>
            <dl class="space-y-5">
              <Property label="Project" icon={<FolderOpen />}>
                {project ? (
                  <Link to={`/projects/${project.id}`} class="hover:underline">
                    {project.name}
                  </Link>
                ) : (
                  story.projectId
                )}
              </Property>
              <Property label="Labels" icon={<Tag />}>
                {fieldValue(fields.labels)}
              </Property>
              {Boolean(
                story.parentKey || fields.parent || fields["epic-link"],
              ) && (
                <Property label="Parent issue">
                  {fieldValue(
                    story.parentKey ?? fields.parent ?? fields["epic-link"],
                  )}
                </Property>
              )}
            </dl>
          </section>
          {extras.length > 0 && (
            <section class="space-y-4">
              <h2 class="text-sm font-medium text-muted-foreground">
                Additional Jira fields
              </h2>
              <dl class="space-y-5">
                {extras.map((id) => (
                  <Property
                    key={id}
                    label={
                      catalogue.find((field) => field.id === id)?.label ?? id
                    }
                  >
                    {fieldValue(fields[id])}
                  </Property>
                ))}
              </dl>
            </section>
          )}
          <section class="space-y-4 border-t pt-6">
            <h2 class="text-sm font-medium text-muted-foreground">
              Agent workflow
            </h2>
            <dl>
              <Property
                label="Current step"
                icon={<ColumnIcon column={story.column} />}
              >
                {
                  kanbanColumns.find((column) => column.id === story.column)
                    ?.title
                }
              </Property>
            </dl>
          </section>
        </aside>
      );
    };
  },
  { name: "JiraProperties", props: ["story"], inheritAttrs: false },
);
