import { ApiError } from "@/api/client";
import { toApiError } from "@/api/errors";
import {
  useJournal,
  useMe,
  useProjects,
  useSavePreferences,
  useStories,
  useStoryMutations,
  useUpdateMe,
} from "@/api/hooks";
import { CodingAgentChip } from "@/components/kanban/coding-agent";
import {
  ColumnIcon,
  IssueTypeIcon,
  PriorityIcon,
} from "@/components/kanban/issue-meta";
import {
  NewStoryDialog,
  type NewStoryInput,
} from "@/components/kanban/new-story-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  issueTypes,
  kanbanColumns,
  roles,
  type NewStoryRequest,
  type Role,
  type UserStory,
} from "@/lib/domain";
import { Navigate, useNavigate, useSearchParams } from "@/lib/router";
import { canReview, stageForColumn, storyStatus } from "@/lib/story-workflow";
import { kanbanColumnStyle, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  Bot,
  CircleCheck,
  Columns3,
  Filter,
  FolderOpen,
  List,
  Loader,
  MessageSquareText,
  SquareKanban,
  TriangleAlert,
  X,
} from "@lucide/vue";
import { defineComponent, ref } from "vue";
const ALL_PROJECTS = "all";
type KanbanView = "board" | "list";
const roleOptions = roles.map((role) => ({ value: role, label: role }));
const typeOptions = [
  { value: "all", label: "All issue types" },
  ...issueTypes.map((type) => ({ value: type, label: type })),
];
export const KanbanPage = defineComponent(
  (__props: Record<string, never>) => {
    const searchParamsState0 = useSearchParams();
    // Kanban filters stay in the URL and are preserved when returning from a ticket.

    const themeState1 = useTheme();

    const navigateState2 = useNavigate();

    const meState3 = useMe();
    // The signed-in user's business role (PATCH /auth/me) determines who can approve each stage.

    const updateMeState4 = useUpdateMe();

    const savePreferencesState5 = useSavePreferences();

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
    const storiesState6 = useStories();
    const projectsState7 = useProjects();
    const storyMutationsState8 = useStoryMutations();
    const journalState9 = useJournal();
    return () => {
      // Kanban filters stay in the URL and are preserved when returning from a ticket.
      const [searchParams, setSearchParams] = searchParamsState0;
      const { theme } = themeState1;
      const projectId = searchParams.get("project") ?? ALL_PROJECTS;
      const requestedType = searchParams.get("type");
      const issueType =
        issueTypes.find((type) => type === requestedType) ?? "all";
      const onlyMyReview = searchParams.get("review") === "mine";
      const navigate = navigateState2;
      const selectedStoryId = searchParams.get("us");
      function updateParams(changes: Record<string, string | null>) {
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            for (const [key, value] of Object.entries(changes)) {
              if (value === null) next.delete(key);
              else next.set(key, value);
            }
            return next;
          },
          { replace: true },
        );
      }
      function setProjectId(value: string) {
        updateParams({ project: value === ALL_PROJECTS ? null : value });
      }
      const returnParams = new URLSearchParams(searchParams);
      returnParams.delete("us");
      const returnTo = `/kanban${returnParams.size ? `?${returnParams}` : ""}`;
      function openStory(id: string) {
        navigate(`/kanban/${encodeURIComponent(id)}`, { state: { returnTo } });
      }
      // The signed-in user's business role (PATCH /auth/me) determines who can approve each stage.
      const { data: me } = meState3;
      const updateMe = updateMeState4;
      const savePreferences = savePreferencesState5;
      const role = me?.role ?? "PO";
      const { data: allStories = [] } = storiesState6;
      const { data: projects = [] } = projectsState7;
      const mutations = storyMutationsState8;
      const matchingStories = allStories.filter(
        (story) =>
          (projectId === ALL_PROJECTS || story.projectId === projectId) &&
          (issueType === "all" || story.type === issueType),
      );
      const mineCount = matchingStories.filter((story) =>
        canReview(story, role),
      ).length;
      const stories = onlyMyReview
        ? matchingStories.filter((story) => canReview(story, role))
        : matchingStories;
      const hasFilters =
        projectId !== ALL_PROJECTS || issueType !== "all" || onlyMyReview;
      const projectOptions = [
        { value: ALL_PROJECTS, label: "All projects" },
        ...projects.map((project) => ({
          value: project.id,
          label: project.name,
        })),
      ];
      const onError = (cause: Error) =>
        setError(cause instanceof ApiError ? describe(cause) : cause.message);
      const onSuccess = () => setError(undefined);
      // The title, parent epic and links are not part of POST /us; links are appended to the requirement.
      function createStory(input: NewStoryInput, force = false) {
        const body: NewStoryRequest = {
          need: [input.raw, ...input.contextLinks].join("\n"),
          project: input.projectId,
          priority: input.priority,
          issueTypeName: input.type,
          force,
        };
        mutations.create
          .trigger(body)
          .then((story) => {
            onSuccess();
            openStory(story.id);
          })
          .catch((error: unknown) => {
            const cause = toApiError(error);
            // 409: confirm before creating a story that resembles an existing requirement.
            if (cause.status === 409 && !force) {
              if (window.confirm(`${describe(cause)}\n\nCreate the US anyway?`))
                createStory(input, true);
              return;
            }
            onError(cause);
          });
      }
      // Board or list view: use the URL value if present, otherwise the user's saved preference.
      const view: KanbanView =
        searchParams.get("view") === "list" ||
        (!searchParams.get("view") && me?.preferences?.kanbanView === "list")
          ? "list"
          : "board";
      function setView(value: KanbanView) {
        updateParams({ view: value });
        savePreferences.trigger({ kanbanView: value });
      }
      // Comment counts per story, read from the journal.
      const { data: journal = [] } = journalState9;
      const commentCount = (story: UserStory) =>
        journal.filter(
          (entry) =>
            entry.usId === story.id &&
            entry.detail &&
            (entry.action === "refused" || entry.action === "rejected"),
        ).length;
      const cardProps = (story: UserStory) => ({
        story,
        mine: canReview(story, role),
        comments: commentCount(story),
        onOpen: () => openStory(story.id),
      });
      // Legacy panel links redirect to the full page.
      if (selectedStoryId) {
        return (
          <Navigate
            to={`/kanban/${encodeURIComponent(selectedStoryId)}`}
            replace
            state={{ returnTo }}
          />
        );
      }
      return (
        <>
          <PageHeader
            title="Kanban"
            icon={SquareKanban}
            actions={
              <NewStoryDialog
                projects={projects}
                epics={allStories.filter((story) => story.type === "Epic")}
                onCreate={createStory}
              />
            }
          />

          <div class="flex flex-wrap items-center gap-2">
            <Select
              modelValue={projectId}
              onUpdate:modelValue={(value) =>
                setProjectId(value ?? ALL_PROJECTS)
              }
            >
              <SelectTrigger
                class="w-52 justify-start hover:bg-interaction-hover data-[state=open]:bg-interaction-selected"
                aria-label="Project"
              >
                <FolderOpen class="text-muted-foreground" aria-hidden="true" />
                <SelectValue class="flex-1 text-left" />
              </SelectTrigger>
              <SelectContent class="[&_[role=listbox]]:flex [&_[role=listbox]]:flex-col [&_[role=listbox]]:gap-[2px] [&_[role=listbox]]:p-[2px]">
                {projectOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    class="focus:bg-interaction-hover data-highlighted:bg-interaction-hover data-[state=checked]:bg-interaction-selected"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              modelValue={role}
              onUpdate:modelValue={(value) =>
                value && updateMe.trigger({ role: value as Role })
              }
            >
              <SelectTrigger class="w-36 justify-start" aria-label="View as">
                <span class="text-muted-foreground">View as</span>
                <SelectValue class="flex-1 text-left" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              modelValue={issueType}
              onUpdate:modelValue={(value) =>
                updateParams({ type: !value || value === "all" ? null : value })
              }
            >
              <SelectTrigger class="w-40 justify-start" aria-label="Issue type">
                <Filter class="text-muted-foreground" aria-hidden="true" />
                <SelectValue class="flex-1 text-left" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.value !== "all" && (
                      <IssueTypeIcon type={option.value as UserStory["type"]} />
                    )}
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Toggle
              variant="outline"
              modelValue={onlyMyReview}
              onUpdate:modelValue={(pressed) =>
                updateParams({ review: pressed ? "mine" : null })
              }
              aria-label="Your review"
              title={`Documents ready for validation as ${role}`}
            >
              <CircleCheck />
              Your review
              <span class="text-xs text-muted-foreground tabular-nums">
                {mineCount}
              </span>
            </Toggle>
            <span class="text-xs text-muted-foreground tabular-nums">
              {stories.length} US
              {mineCount > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span class="text-primary">{mineCount} waiting for you</span>
                </>
              )}
            </span>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateParams({ project: null, type: null, review: null })
                }
              >
                <X />
                Clear filters
              </Button>
            )}

            <div
              class="ml-auto flex items-center rounded-lg border p-0.5"
              role="group"
              aria-label="Display"
            >
              <Toggle
                size="sm"
                modelValue={view === "board"}
                onUpdate:modelValue={() => setView("board")}
                aria-label="Board view"
              >
                <Columns3 />
                Board
              </Toggle>
              <Toggle
                size="sm"
                modelValue={view === "list"}
                onUpdate:modelValue={() => setView("list")}
                aria-label="List view"
              >
                <List />
                List
              </Toggle>
            </div>
          </div>

          {error.value && (
            <Alert variant="destructive" class="mt-4">
              <TriangleAlert />
              <AlertDescription>{error.value}</AlertDescription>
            </Alert>
          )}

          {hasFilters && stories.length === 0 && (
            <p
              role="status"
              class="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
            >
              No tickets match these filters
              {onlyMyReview ? ` for your role (${role})` : ""}. Change or clear
              the filters to see more tickets.
            </p>
          )}

          {view === "board" ? (
            <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {kanbanColumns.map((column) => {
                const columnStories = stories.filter(
                  (story) => story.column === column.id,
                );
                return (
                  <section
                    key={column.id}
                    class="flex min-h-96 flex-col gap-2 rounded-xl bg-muted/40 p-2"
                    style={kanbanColumnStyle(theme.kanbanColumns[column.id])}
                  >
                    <ColumnHeader
                      column={column}
                      count={columnStories.length}
                      className="px-1.5 py-1"
                    />
                    {columnStories.map((story) => (
                      <StoryCard key={story.id} {...cardProps(story)} />
                    ))}
                  </section>
                );
              })}
            </div>
          ) : (
            <div class="mt-4 space-y-4">
              {kanbanColumns.map((column) => {
                const columnStories = stories.filter(
                  (story) => story.column === column.id,
                );
                return (
                  <section key={column.id}>
                    <ColumnHeader
                      column={column}
                      count={columnStories.length}
                      className="h-9 rounded-md bg-muted/50 px-3"
                      showAgent
                    />
                    {columnStories.length > 0 && (
                      <ul class="divide-y">
                        {columnStories.map((story) => (
                          <StoryRow
                            key={story.id}
                            {...cardProps(story)}
                            project={
                              projects.find(
                                (item) => item.id === story.projectId,
                              )?.name
                            }
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      );
    };
  },
  { name: "KanbanPage", props: [], inheritAttrs: false },
);
type Column = (typeof kanbanColumns)[number];
const ColumnHeader = defineComponent(
  (__props: {
    column: Column;
    count: number;
    className?: string;
    showAgent?: boolean;
  }) => {
    return () => {
      const { column, count, className, showAgent } = __props;
      return (
        <h2
          class={cn("flex items-center gap-2 text-sm font-medium", className)}
        >
          <ColumnIcon column={column.id} />
          {column.title}
          <span class="font-normal text-muted-foreground tabular-nums">
            {count}
          </span>
          {showAgent ? (
            <span class="ml-2 flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Bot class="size-3.5" aria-hidden="true" />
              {column.agent}
            </span>
          ) : (
            <Tooltip>
              <TooltipTrigger aria-label={column.agent} asChild>
                <span class="ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Bot class="size-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{column.agent}</TooltipContent>
            </Tooltip>
          )}
        </h2>
      );
    };
  },
  {
    name: "ColumnHeader",
    props: ["column", "count", "className", "showAgent"],
    inheritAttrs: false,
  },
);
type StoryItemProps = {
  story: UserStory;
  // The current stage document is awaiting approval from the selected role.
  mine: boolean;
  comments: number;
  onOpen: () => void;
};
const StoryCard = defineComponent(
  (__props: StoryItemProps) => {
    return () => {
      const { story, mine, comments, onOpen } = __props;
      return (
        <Card
          size="sm"
          class="relative gap-2 text-foreground transition-shadow hover:shadow-md hover:ring-foreground/20"
        >
          {mine && (
            <span
              class="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-primary"
              aria-hidden="true"
            />
          )}
          <CardHeader class="gap-1.5">
            <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span class="font-mono">{story.key}</span>
              <PriorityIcon priority={story.priority} className="ml-auto" />
            </div>
            <CardTitle class="line-clamp-2 leading-snug font-medium">
              {/* The button's expanded pseudo-element makes the entire card clickable. */}
              <button
                type="button"
                onClick={onOpen}
                class="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {story.title}
              </button>
            </CardTitle>
            <div class="flex min-h-5 items-center gap-2.5">
              <IssueTypeIcon type={story.type} />
              <StoryIndicators story={story} mine={mine} comments={comments} />
            </div>
          </CardHeader>
        </Card>
      );
    };
  },
  {
    name: "StoryCard",
    props: ["story", "mine", "comments", "onOpen"],
    inheritAttrs: false,
  },
);
const StoryRow = defineComponent(
  (
    __props: StoryItemProps & {
      project?: string;
    },
  ) => {
    return () => {
      const { story, mine, comments, onOpen, project } = __props;
      return (
        <li>
          <button
            type="button"
            onClick={onOpen}
            class="flex h-10 w-full items-center gap-3 px-3 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <span
              class={cn(
                "size-1.5 shrink-0 rounded-full",
                mine ? "bg-primary" : "bg-transparent",
              )}
              aria-hidden="true"
            />
            <PriorityIcon priority={story.priority} />
            <IssueTypeIcon type={story.type} />
            <span class="w-16 shrink-0 font-mono text-xs text-muted-foreground">
              {story.key}
            </span>
            <span class="min-w-0 flex-1 truncate font-medium">
              {story.title}
            </span>
            <span class="flex shrink-0 items-center gap-2.5">
              <StoryIndicators story={story} mine={mine} comments={comments} />
            </span>
            {project && (
              <span class="hidden w-40 shrink-0 truncate text-right text-xs text-muted-foreground md:block">
                {project}
              </span>
            )}
          </button>
        </li>
      );
    };
  },
  {
    name: "StoryRow",
    props: ["story", "mine", "comments", "onOpen", "project"],
    inheritAttrs: false,
  },
);
const StoryIndicators = defineComponent(
  (__props: Omit<StoryItemProps, "onOpen">) => {
    return () => {
      const { story, mine, comments } = __props;
      const stage = stageForColumn(story.column);
      const status = storyStatus(story);
      return (
        <>
          {status === "agent-working" && (
            <span
              class="flex items-center gap-1 text-xs text-muted-foreground"
              title={`${stage?.agent} is working`}
            >
              <Loader class="size-3.5 animate-spin" aria-hidden="true" />
              Agent
            </span>
          )}
          {comments > 0 && (
            <span
              class={cn(
                "flex items-center gap-1 text-xs tabular-nums",
                status === "changes-requested"
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground",
              )}
              title={
                status === "changes-requested"
                  ? "Changes requested"
                  : `${comments} comments`
              }
            >
              <MessageSquareText class="size-3.5" aria-hidden="true" />
              {comments}
            </span>
          )}
          {status === "changes-requested" && comments === 0 && (
            <MessageSquareText
              class="size-3.5 text-amber-700 dark:text-amber-400"
              aria-label="Changes requested"
            />
          )}
          {story.codingAgent && <CodingAgentChip run={story.codingAgent} />}
          {status === "to-review" && stage && (
            <span
              class={cn(
                "ml-auto text-xs",
                mine ? "font-medium text-primary" : "text-muted-foreground",
              )}
              title={`Validation by ${stage.approvers.join(" or ")}`}
            >
              {mine ? "Your review" : stage.approvers.join(" · ")}
            </span>
          )}
        </>
      );
    };
  },
  {
    name: "StoryIndicators",
    props: ["story", "mine", "comments"],
    inheritAttrs: false,
  },
);
function describe(error: ApiError) {
  const detail = error.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail)
    return String(detail.message);
  return `Request failed (${error.status})`;
}
