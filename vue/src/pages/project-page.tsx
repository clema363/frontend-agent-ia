import {
  useMe,
  useProjectMutations,
  useProjects,
  useStories,
} from "@/api/hooks";
import { ColumnIcon } from "@/components/kanban/issue-meta";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressRing } from "@/components/progress-ring";
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import { ProjectContext } from "@/components/projects/project-context";
import { ProjectJiraFields } from "@/components/projects/project-jira-fields";
import { ProjectMembers } from "@/components/projects/project-members";
import { RoleBadges, SectionHeader } from "@/components/projects/project-parts";
import { SourcesSection } from "@/components/projects/project-sources";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { kanbanColumns, type Project } from "@/lib/domain";
import { Link, NavLink, useNavigate, useParams } from "@/lib/router";
import { cn, progressOf } from "@/lib/utils";
import {
  ArrowRight,
  Ellipsis,
  FolderOpen,
  SquareKanban,
  Trash2,
} from "@lucide/vue";
import { defineComponent, ref, type VNodeChild } from "vue";
const tabs = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Members" },
  { id: "fields", label: "Jira fields" },
  { id: "context", label: "Context" },
] as const;
type TabId = (typeof tabs)[number]["id"];
// Centered reading column shared by tabs and their content.
const column = "mx-auto w-full max-w-4xl";
export const ProjectPage = defineComponent(
  (__props: Record<string, never>) => {
    const paramsState0 = useParams();

    const projectsState1 = useProjects();

    const meState2 = useMe();

    const projectMutationsState3 = useProjectMutations();

    const navigateState4 = useNavigate();

    const deleting = ref(false);
    const setDeleting = (
      next:
        | typeof deleting.value
        | ((current: typeof deleting.value) => typeof deleting.value),
    ) => {
      deleting.value =
        typeof next === "function"
          ? (next as (current: typeof deleting.value) => typeof deleting.value)(
              deleting.value,
            )
          : next;
    };
    return () => {
      const { projectId = "", tab = "overview" } = paramsState0;
      const { data: projects, isLoading } = projectsState1;
      const { data: me } = meState2;
      const { delete: deleteProject } = projectMutationsState3;
      const navigate = navigateState4;
      const project = projects?.find((item) => item.id === projectId);
      const boardUrl = `/kanban?project=${projectId}`;
      if (!project) {
        return (
          <>
            <PageHeader
              title={isLoading ? "…" : "Not found"}
              icon={FolderOpen}
              parent={{ label: "Projects", to: "/projects" }}
            />
            {!isLoading && (
              <p class="text-sm text-muted-foreground">
                This project does not exist or you are not a member.{" "}
                <Link to="/projects" class="text-primary hover:underline">
                  Back to projects
                </Link>
              </p>
            )}
          </>
        );
      }
      return (
        <>
          <PageHeader
            title={project.name}
            icon={FolderOpen}
            parent={{ label: "Projects", to: "/projects" }}
            actions={
              <>
                <Link
                  to={boardUrl}
                  class={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <SquareKanban data-icon="inline-start" />
                  Open board
                </Link>
                {me?.isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Project actions"
                      >
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-44">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleting(true)}
                      >
                        <Trash2 />
                        Delete project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            }
          />

          {/* Tabs use the URL so each section has its own address and the Back button works. */}
          <nav
            aria-label="Project sections"
            class="-mx-6 -mt-6 mb-8 h-10 border-b px-6"
          >
            {/* Use the same centered column as the content to align the tabs. */}
            <div class={`${column} flex h-full items-stretch gap-1`}>
              {tabs.map((item) => (
                <NavLink
                  key={item.id}
                  to={
                    item.id === "overview"
                      ? `/projects/${project.id}`
                      : `/projects/${project.id}/${item.id}`
                  }
                  end
                  class={({ isActive }) =>
                    cn(
                      "-mb-px flex items-center border-b-2 px-2 text-sm transition-colors first:-ml-2",
                      isActive
                        ? "border-primary font-medium text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>

          <div key={tab} class={`${column} animate-in fade-in-0 duration-200`}>
            <ProjectTab
              tab={tab as TabId}
              project={project}
              boardUrl={boardUrl}
            />
          </div>

          <DeleteProjectDialog
            project={project}
            open={deleting.value}
            onOpenChange={setDeleting}
            onDelete={(id) =>
              deleteProject
                .trigger(id)
                .then(() => navigate("/projects"))
                .catch(() => undefined)
            }
          />
        </>
      );
    };
  },
  { name: "ProjectPage", props: [], inheritAttrs: false },
);
const ProjectTab = defineComponent(
  (__props: { tab: TabId; project: Project; boardUrl: string }) => {
    return () => {
      const { tab, project, boardUrl } = __props;
      switch (tab) {
        case "members":
          return <ProjectMembers project={project} />;
        case "fields":
          return <ProjectJiraFields project={project} />;
        case "context":
          return <ProjectContext project={project} />;
        default:
          return <ProjectOverview project={project} boardUrl={boardUrl} />;
      }
    };
  },
  {
    name: "ProjectTab",
    props: ["tab", "project", "boardUrl"],
    inheritAttrs: false,
  },
);
const ProjectOverview = defineComponent(
  (__props: { project: Project; boardUrl: string }) => {
    const storiesState5 = useStories();
    return () => {
      const { project, boardUrl } = __props;
      const { data: stories = [] } = storiesState5;
      const projectStories = stories.filter(
        (story) => story.projectId === project.id,
      );
      const progress = progressOf(project.completed, project.userStories);
      return (
        <div class="space-y-10">
          <section class="space-y-4">
            <div class="flex items-center gap-3">
              <span class="flex size-10 items-center justify-center rounded-lg border bg-muted/50">
                <FolderOpen
                  class="size-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </span>
              <div class="min-w-0">
                <h2 class="truncate text-xl font-semibold tracking-tight">
                  {project.name}
                </h2>
                <p class="font-mono text-xs text-muted-foreground">
                  {project.key}
                </p>
              </div>
            </div>

            {/* Project properties on one row, similar to a Linear project header. */}
            <dl class="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <Property label="Progress">
                <span class="flex items-center gap-2 tabular-nums">
                  <ProgressRing value={progress} />
                  {progress} %
                </span>
              </Property>
              <Property label="User stories">
                <span class="tabular-nums">
                  {project.userStories}{" "}
                  <span class="text-muted-foreground">
                    · {project.completed} sent to AI
                  </span>
                </span>
              </Property>
              <Property label="Members">
                <Link
                  to={`/projects/${project.id}/members`}
                  class="tabular-nums hover:underline"
                >
                  {project.memberCount}
                </Link>
              </Property>
              <Property label="Your roles">
                <RoleBadges roles={project.myRoles} />
              </Property>
            </dl>
          </section>

          <section class="space-y-4">
            <SectionHeader
              title="Pipeline"
              count={projectStories.length}
              actions={
                <Link
                  to={boardUrl}
                  class="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Open board
                  <ArrowRight class="size-3.5" aria-hidden="true" />
                </Link>
              }
            >
              Where the user stories of this project stand.
            </SectionHeader>
            <ul class="divide-y rounded-lg border text-sm">
              {kanbanColumns.map((column) => {
                const count = projectStories.filter(
                  (story) => story.column === column.id,
                ).length;
                const share = projectStories.length
                  ? (count / projectStories.length) * 100
                  : 0;
                return (
                  <li key={column.id}>
                    <Link
                      to={boardUrl}
                      class="flex h-10 items-center gap-4 px-4 transition-colors hover:bg-muted/50"
                    >
                      <span class="flex w-36 shrink-0 items-center gap-2 font-medium">
                        <ColumnIcon column={column.id} />
                        {column.title}
                      </span>
                      <span class="hidden w-36 shrink-0 text-xs text-muted-foreground sm:block">
                        {column.agent}
                      </span>
                      <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          class="block h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${share}%`,
                            backgroundColor: column.color,
                          }}
                        />
                      </span>
                      <span class="w-6 text-right text-muted-foreground tabular-nums">
                        {count}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <SourcesSection project={project} />
        </div>
      );
    };
  },
  {
    name: "ProjectOverview",
    props: ["project", "boardUrl"],
    inheritAttrs: false,
  },
);
const Property = defineComponent(
  (
    __props: {
      label: string;
      children?: VNodeChild;
    },
    { slots },
  ) => {
    return () => {
      const { label, children } = { ...__props, children: slots.default?.() };
      return (
        <div class="space-y-1">
          <dt class="text-xs text-muted-foreground">{label}</dt>
          <dd>{children}</dd>
        </div>
      );
    };
  },
  { name: "Property", props: ["label"], inheritAttrs: false },
);
