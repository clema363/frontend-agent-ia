import { useMe, useProjectMutations, useProjects } from "@/api/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressRing } from "@/components/progress-ring";
import {
  NewProjectDialog,
  type NewProjectInput,
} from "@/components/projects/new-project-dialog";
import { RoleBadges } from "@/components/projects/project-parts";
import { Progress } from "@/components/ui/progress";
import type { Project } from "@/lib/domain";
import { Link, useNavigate } from "@/lib/router";
import { cn, progressOf } from "@/lib/utils";
import {
  FolderOpen,
  LayoutGrid,
  List,
  Search,
  type LucideIcon,
} from "@lucide/vue";
import { defineComponent, ref } from "vue";
type ViewMode = "list" | "cards";
// Preserve the selected view mode between visits.
const VIEW_KEY = "projects-view";
// Columns shared by the list header and rows.
const rowGrid =
  "grid grid-cols-[minmax(0,1fr)_7rem_4rem_5.5rem] items-center gap-4 md:grid-cols-[minmax(0,1fr)_7rem_4rem_5.5rem_12rem]";
export const ProjectsPage = defineComponent(
  (__props: Record<string, never>) => {
    const search = ref("");
    const setSearch = (
      next:
        | typeof search.value
        | ((current: typeof search.value) => typeof search.value),
    ) => {
      search.value =
        typeof next === "function"
          ? (next as (current: typeof search.value) => typeof search.value)(
              search.value,
            )
          : next;
    };
    const view = ref<ViewMode>(
      (() => (localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "list"))(),
    );
    const setView = (next: ViewMode | ((current: ViewMode) => ViewMode)) => {
      view.value =
        typeof next === "function"
          ? (next as (current: typeof view.value) => typeof view.value)(
              view.value,
            )
          : next;
    };
    const projectsState0 = useProjects();
    const meState1 = useMe();
    const projectMutationsState2 = useProjectMutations();
    const navigateState3 = useNavigate();
    return () => {
      const { data: projects = [] } = projectsState0;
      const { data: me } = meState1;
      const mutations = projectMutationsState2;
      const navigate = navigateState3;
      const query = search.value.trim().toLowerCase();
      const filtered = projects.filter(
        (project) =>
          project.name.toLowerCase().includes(query) ||
          project.key.toLowerCase().includes(query),
      );
      function changeView(mode: ViewMode) {
        setView(mode);
        localStorage.setItem(VIEW_KEY, mode);
      }
      function createProject(input: NewProjectInput) {
        mutations.create
          .trigger(input)
          .then((project) => navigate(`/projects/${project.id}`))
          .catch(() => undefined);
      }
      return (
        <>
          <PageHeader
            title="Projects"
            icon={FolderOpen}
            actions={
              me?.isAdmin && (
                <>
                  <NewProjectDialog onCreate={createProject} />
                </>
              )
            }
          />

          <div class="mb-4 flex items-center gap-3">
            <label class="flex h-8 w-full max-w-xs items-center gap-2 rounded-md border px-2.5 text-sm transition-colors focus-within:border-ring">
              <Search
                class="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={search.value}
                onInput={(event) =>
                  setSearch((event.target as HTMLInputElement).value)
                }
                placeholder="Filter projects…"
                class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
            <p class="text-xs text-muted-foreground tabular-nums">
              {filtered.length} of {projects.length}
            </p>
            <div
              role="group"
              aria-label="View"
              class="ml-auto flex rounded-md border p-0.5"
            >
              <ViewButton
                icon={List}
                label="List"
                active={view.value === "list"}
                onClick={() => changeView("list")}
              />
              <ViewButton
                icon={LayoutGrid}
                label="Cards"
                active={view.value === "cards"}
                onClick={() => changeView("cards")}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p class="border-t py-10 text-center text-sm text-muted-foreground">
              {projects.length
                ? `No project matches “${search.value}”.`
                : "No project yet."}
            </p>
          ) : view.value === "cards" ? (
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div class="-mx-6 border-t text-sm">
              <div
                class={`${rowGrid} h-8 border-b px-6 text-xs text-muted-foreground`}
              >
                <span>Name</span>
                <span>Progress</span>
                <span class="text-right">US</span>
                <span>Members</span>
                <span class="hidden md:block">Your roles</span>
              </div>
              {filtered.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </div>
          )}
        </>
      );
    };
  },
  { name: "ProjectsPage", props: [], inheritAttrs: false },
);
const ProjectRow = defineComponent(
  (__props: { project: Project }) => {
    return () => {
      const { project } = __props;
      const progress = progressOf(project.completed, project.userStories);
      return (
        <Link
          to={`/projects/${project.id}`}
          class={`${rowGrid} h-11 border-b px-6 transition-colors hover:bg-interaction-hover active:bg-interaction-selected focus-visible:bg-interaction-hover focus-visible:outline-none`}
        >
          <span class="flex min-w-0 items-center gap-2.5">
            <FolderOpen
              class="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span class="truncate font-medium">{project.name}</span>
            <span class="font-mono text-xs text-muted-foreground">
              {project.key}
            </span>
          </span>
          <span class="flex items-center gap-2 text-muted-foreground tabular-nums">
            <ProgressRing value={progress} />
            {progress} %
          </span>
          <span class="text-right text-muted-foreground tabular-nums">
            {project.userStories}
          </span>
          <span class="text-muted-foreground tabular-nums">
            {project.memberCount}
          </span>
          <span class="hidden md:block">
            <RoleBadges roles={project.myRoles} />
          </span>
        </Link>
      );
    };
  },
  { name: "ProjectRow", props: ["project"], inheritAttrs: false },
);
const ProjectCard = defineComponent(
  (__props: { project: Project }) => {
    return () => {
      const { project } = __props;
      const progress = progressOf(project.completed, project.userStories);
      return (
        <Link
          to={`/projects/${project.id}`}
          class="group flex flex-col gap-4 rounded-lg border p-4 text-sm transition-all hover:border-foreground/20 hover:bg-interaction-hover active:bg-interaction-selected hover:shadow-sm focus-visible:border-ring focus-visible:outline-none"
        >
          <div class="flex items-start gap-3">
            <span class="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50">
              <FolderOpen
                class="size-4 text-muted-foreground transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
            </span>
            <div class="min-w-0">
              <p class="truncate font-medium">{project.name}</p>
              <p class="font-mono text-xs text-muted-foreground">
                {project.key}
              </p>
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
              <span>
                {project.completed} / {project.userStories} US sent to AI
              </span>
              <span>{progress} %</span>
            </div>
            <Progress modelValue={progress} />
          </div>

          <div class="mt-auto flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
            <span class="tabular-nums">{project.memberCount} member(s)</span>
            <RoleBadges roles={project.myRoles} />
          </div>
        </Link>
      );
    };
  },
  { name: "ProjectCard", props: ["project"], inheritAttrs: false },
);
type ViewButtonProps = {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
};
const ViewButton = defineComponent(
  (__props: ViewButtonProps) => {
    return () => {
      const { icon: Icon, label, active, onClick } = __props;
      return (
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          title={label}
          onClick={onClick}
          class={cn(
            "flex size-6 items-center justify-center rounded-sm transition-colors",
            active
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon class="size-3.5" />
        </button>
      );
    };
  },
  {
    name: "ViewButton",
    props: ["icon", "label", "active", "onClick"],
    inheritAttrs: false,
  },
);
