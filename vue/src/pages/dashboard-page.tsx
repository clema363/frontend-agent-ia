import {
  useHealth,
  useJournal,
  useMe,
  useProjects,
  useStats,
  useStories,
} from "@/api/hooks";
import { IssueTypeIcon, PriorityIcon } from "@/components/kanban/issue-meta";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressRing } from "@/components/progress-ring";
import { SectionHeader } from "@/components/projects/project-parts";
import {
  journalActionLabels,
  kanbanColumns,
  stages,
  type JournalEntry,
  type Project,
  type UserStory,
} from "@/lib/domain";
import { Link } from "@/lib/router";
import { canReview, stageForColumn, storyStatus } from "@/lib/story-workflow";
import { cn, progressOf, timeAgo } from "@/lib/utils";
import {
  ArrowRight,
  Bot,
  CircleCheck,
  CircleX,
  CopyCheck,
  Inbox,
  LayoutDashboard,
  Send,
  TriangleAlert,
  type LucideIcon,
} from "@lucide/vue";
import { defineComponent, type VNodeChild } from "vue";
// Link to the full ticket page.
const storyUrl = (story: UserStory) =>
  `/kanban/${encodeURIComponent(story.id)}`;
export const DashboardPage = defineComponent(
  (__props: Record<string, never>) => {
    const meState0 = useMe();
    const storiesState1 = useStories();
    const projectsState2 = useProjects();
    return () => {
      const { data: me } = meState0;
      const { data: stories = [] } = storiesState1;
      const { data: projects = [] } = projectsState2;
      const role = me?.role ?? "PO";
      const toReview = stories.filter((story) => canReview(story, role));
      const count = (status: ReturnType<typeof storyStatus>) =>
        stories.filter((story) => storyStatus(story) === status).length;
      return (
        <>
          <PageHeader title="Dashboard" icon={LayoutDashboard} />

          <div class="w-full space-y-5">
            <HealthWarning />

            <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
              <Kpi
                icon={Inbox}
                label="To review by you"
                value={toReview.length}
                hint={`as ${role}`}
                to="/kanban"
                accent
              />
              <Kpi
                icon={CircleX}
                label="Changes requested"
                value={count("changes-requested")}
                hint="reworked by the agents"
                to="/kanban"
              />
              <Kpi
                icon={Bot}
                label="Agents working"
                value={count("agent-working")}
                hint="document in progress"
                to="/kanban"
              />
              <Kpi
                icon={Send}
                label="Sent to AI"
                value={count("sent-to-ai")}
                hint="ready for development"
                to="/kanban"
              />
            </dl>

            <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <section class="min-w-0 space-y-3">
                <SectionHeader
                  title="Waiting for you"
                  count={toReview.length}
                  actions={
                    <Link
                      to="/kanban"
                      class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      All tickets
                      <ArrowRight class="size-3.5" aria-hidden="true" />
                    </Link>
                  }
                >
                  Documents ready for your validation as{" "}
                  <strong class="font-medium text-foreground">{role}</strong>.
                </SectionHeader>
                {toReview.length ? (
                  <ul class="divide-y rounded-lg border text-sm">
                    {toReview.slice(0, 6).map((story) => (
                      <ReviewRow
                        key={story.id}
                        story={story}
                        project={projects.find(
                          (item) => item.id === story.projectId,
                        )}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={CircleCheck}>
                    Nothing to validate. You're all caught up.
                  </EmptyState>
                )}
              </section>

              <Activity stories={stories} />

              <section class="min-w-0 space-y-3">
                <SectionHeader
                  title="Projects"
                  count={projects.length}
                  actions={
                    <Link
                      to="/projects"
                      class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      All projects
                      <ArrowRight class="size-3.5" aria-hidden="true" />
                    </Link>
                  }
                >
                  Progress and distribution of stories across your projects.
                </SectionHeader>
                {projects.length ? (
                  <ul class="divide-y rounded-lg border text-sm">
                    {projects.slice(0, 4).map((project) => (
                      <ProjectRow
                        key={project.id}
                        project={project}
                        stories={stories.filter(
                          (story) => story.projectId === project.id,
                        )}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={Inbox}>No projects yet.</EmptyState>
                )}
              </section>
              <Duplicates />
            </div>
          </div>
        </>
      );
    };
  },
  { name: "DashboardPage", props: [], inheritAttrs: false },
);
const HealthWarning = defineComponent(
  (__props: Record<string, never>) => {
    const healthState3 = useHealth();
    return () => {
      const { data: health } = healthState3;
      if (!health || health.llmConfigured) return null;
      return (
        <p class="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert class="size-4" aria-hidden="true" />
          No LLM configured on the server: the agents cannot run.
          <Link to="/settings" class="ml-auto font-medium hover:underline">
            Settings
          </Link>
        </p>
      );
    };
  },
  { name: "HealthWarning", props: [], inheritAttrs: false },
);
type KpiProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  to: string;
  accent?: boolean;
};
const Kpi = defineComponent(
  (__props: KpiProps) => {
    return () => {
      const { icon: Icon, label, value, hint, to, accent } = __props;
      return (
        <Link
          to={to}
          class="group bg-background px-4 py-3 transition-colors hover:bg-muted/40"
        >
          <dt class="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon
              class={cn("size-3.5", accent && value > 0 && "text-primary")}
              aria-hidden="true"
            />
            {label}
          </dt>
          <dd class="mt-2 flex items-baseline gap-2">
            <span
              class={cn(
                "text-2xl font-semibold tabular-nums",
                accent && value > 0 && "text-primary",
              )}
            >
              {value}
            </span>
            <span class="truncate text-xs text-muted-foreground">{hint}</span>
          </dd>
        </Link>
      );
    };
  },
  {
    name: "Kpi",
    props: ["icon", "label", "value", "hint", "to", "accent"],
    inheritAttrs: false,
  },
);
const ReviewRow = defineComponent(
  (__props: { story: UserStory; project?: Project }) => {
    return () => {
      const { story, project } = __props;
      const stage = stageForColumn(story.column);
      return (
        <li>
          <Link
            to={storyUrl(story)}
            class="flex h-11 items-center gap-3 px-4 transition-colors hover:bg-muted/50"
          >
            <PriorityIcon priority={story.priority} />
            <IssueTypeIcon type={story.type} />
            <span class="w-16 shrink-0 font-mono text-xs text-muted-foreground">
              {story.key}
            </span>
            <span class="min-w-0 flex-1 truncate font-medium">
              {story.title}
            </span>
            <span class="hidden shrink-0 text-xs text-muted-foreground sm:block">
              {project?.name}
            </span>
            {stage && (
              <span class="shrink-0 rounded border px-1.5 py-px text-[11px] leading-4 text-muted-foreground">
                {stage.label}
              </span>
            )}
          </Link>
        </li>
      );
    };
  },
  { name: "ReviewRow", props: ["story", "project"], inheritAttrs: false },
);
const Activity = defineComponent(
  (__props: { stories: UserStory[] }) => {
    const journalState4 = useJournal();
    return () => {
      const { stories } = __props;
      const { data: journal = [] } = journalState4;
      const entries = [...journal]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 4);
      return (
        <section class="min-w-0 space-y-3">
          <SectionHeader
            title="Recent activity"
            actions={
              <Link
                to="/journal"
                class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Journal
                <ArrowRight class="size-3.5" aria-hidden="true" />
              </Link>
            }
          />
          {entries.length ? (
            <ol class="space-y-2 border-l pl-4 text-sm">
              {entries.map((entry) => (
                <ActivityItem
                  key={entry.id}
                  entry={entry}
                  story={stories.find((story) => story.id === entry.usId)}
                />
              ))}
            </ol>
          ) : (
            <EmptyState icon={Inbox}>No activity yet.</EmptyState>
          )}
        </section>
      );
    };
  },
  { name: "Activity", props: ["stories"], inheritAttrs: false },
);
const ActivityItem = defineComponent(
  (__props: { entry: JournalEntry; story?: UserStory }) => {
    return () => {
      const { entry, story } = __props;
      const stage = stages.find((item) => item.id === entry.stage);
      return (
        <li class="relative">
          <span
            class="absolute top-1.5 -left-[1.3rem] size-2 rounded-full border-2 border-background bg-muted-foreground/40"
            aria-hidden="true"
          />
          <p
            class="line-clamp-2"
            title={`${entry.actor} ${journalActionLabels[entry.action] ?? entry.action} ${story?.key ?? entry.usId}${stage ? ` · ${stage.label}` : ""}`}
          >
            <span class="font-medium">{entry.actor}</span>{" "}
            <span class="text-muted-foreground">
              {journalActionLabels[entry.action] ?? entry.action}
            </span>{" "}
            {story ? (
              <Link
                to={storyUrl(story)}
                class="font-mono text-xs hover:underline"
              >
                {story.key}
              </Link>
            ) : (
              <span class="font-mono text-xs">{entry.usId}</span>
            )}
            {stage && (
              <span class="text-muted-foreground"> · {stage.label}</span>
            )}
          </p>
          {entry.detail && (
            <p class="mt-0.5 truncate text-xs text-muted-foreground">
              {entry.detail}
            </p>
          )}
          <time datetime={entry.at} class="text-xs text-muted-foreground">
            {timeAgo(entry.at)}
          </time>
        </li>
      );
    };
  },
  { name: "ActivityItem", props: ["entry", "story"], inheritAttrs: false },
);
const ProjectRow = defineComponent(
  (__props: { project: Project; stories: UserStory[] }) => {
    return () => {
      const { project, stories } = __props;
      const progress = progressOf(project.completed, project.userStories);
      return (
        <li>
          <Link
            to={`/projects/${project.id}`}
            class="flex h-12 items-center gap-4 px-4 transition-colors hover:bg-muted/50"
          >
            <ProgressRing value={progress} />
            <span class="min-w-0 flex-1 truncate font-medium">
              {project.name}
            </span>
            {/* Story distribution across Kanban columns, from creation to handoff to the coding agent. */}
            <span
              class="hidden h-1.5 w-40 overflow-hidden rounded-full bg-muted sm:flex"
              title="US per board column"
            >
              {kanbanColumns.map((column) => {
                const count = stories.filter(
                  (story) => story.column === column.id,
                ).length;
                return (
                  <span
                    key={column.id}
                    class="h-full"
                    style={{
                      width: stories.length
                        ? `${(count / stories.length) * 100}%`
                        : 0,
                      backgroundColor: column.color,
                    }}
                  />
                );
              })}
            </span>
            <span class="w-14 text-right text-xs text-muted-foreground tabular-nums">
              {stories.length} US
            </span>
          </Link>
        </li>
      );
    };
  },
  { name: "ProjectRow", props: ["project", "stories"], inheritAttrs: false },
);
const Duplicates = defineComponent(
  (__props: Record<string, never>) => {
    const statsState5 = useStats();
    return () => {
      const { data: stats } = statsState5;
      return (
        <section class="min-w-0 space-y-3">
          <SectionHeader title="Duplicate prevention">
            Needs checked against existing US and Jira tickets.
          </SectionHeader>
          <dl class="divide-y rounded-lg border text-sm">
            <StatRow
              icon={CopyCheck}
              label="Needs flagged as duplicates"
              value={stats?.flaggedNeeds}
            />
            <StatRow
              icon={TriangleAlert}
              label="US created despite a warning"
              value={stats?.createdDespiteWarnings}
            />
          </dl>
        </section>
      );
    };
  },
  { name: "Duplicates", props: [], inheritAttrs: false },
);
const StatRow = defineComponent(
  (__props: { icon: LucideIcon; label: string; value?: number }) => {
    return () => {
      const { icon: Icon, label, value } = __props;
      return (
        <div class="flex h-11 items-center gap-3 px-4">
          <Icon class="size-4 text-muted-foreground" aria-hidden="true" />
          <dt class="flex-1 text-muted-foreground">{label}</dt>
          <dd class="font-medium tabular-nums">{value ?? "–"}</dd>
        </div>
      );
    };
  },
  { name: "StatRow", props: ["icon", "label", "value"], inheritAttrs: false },
);
const EmptyState = defineComponent(
  (
    __props: {
      icon: LucideIcon;
      children?: VNodeChild;
    },
    { slots },
  ) => {
    return () => {
      const { icon: Icon, children } = {
        ...__props,
        children: slots.default?.(),
      };
      return (
        <p class="flex items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
          <Icon class="size-4" aria-hidden="true" />
          {children}
        </p>
      );
    };
  },
  { name: "EmptyState", props: ["icon"], inheritAttrs: false },
);
