import { useState } from 'react'
import { FolderOpen, LayoutGrid, List, Search, type LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useMe, useProjectMutations, useProjects } from '@/api/hooks'
import { PageHeader } from '@/components/layout/page-header'
import { ProgressRing } from '@/components/progress-ring'
import { NewProjectDialog, type NewProjectInput } from '@/components/projects/new-project-dialog'
import { RoleBadges } from '@/components/projects/project-parts'
import { Progress } from '@/components/ui/progress'
import type { Project } from '@/lib/domain'
import { cn, progressOf } from '@/lib/utils'

type ViewMode = 'list' | 'cards'

// Le mode d'affichage choisi est gardé d'une visite à l'autre.
const VIEW_KEY = 'projects-view'

// Colonnes partagées par l'en-tête et les lignes de la liste.
const rowGrid = 'grid grid-cols-[minmax(0,1fr)_7rem_4rem_5.5rem] items-center gap-4 md:grid-cols-[minmax(0,1fr)_7rem_4rem_5.5rem_12rem]'

export function ProjectsPage() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'list'))
  const { data: projects = [] } = useProjects()
  const { data: me } = useMe()
  const mutations = useProjectMutations()
  const navigate = useNavigate()
  const query = search.trim().toLowerCase()
  const filtered = projects.filter(
    (project) => project.name.toLowerCase().includes(query) || project.key.toLowerCase().includes(query),
  )

  function changeView(mode: ViewMode) {
    setView(mode)
    localStorage.setItem(VIEW_KEY, mode)
  }

  function createProject(input: NewProjectInput) {
    mutations.create.mutate(input, { onSuccess: (project) => navigate(`/projects/${project.id}`) })
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

      <div className="mb-4 flex items-center gap-3">
        <label className="flex h-8 w-full max-w-xs items-center gap-2 rounded-md border px-2.5 text-sm transition-colors focus-within:border-ring">
          <Search className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter projects…"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
        <p className="text-xs text-muted-foreground tabular-nums">
          {filtered.length} of {projects.length}
        </p>
        <div role="group" aria-label="View" className="ml-auto flex rounded-md border p-0.5">
          <ViewButton icon={List} label="List" active={view === 'list'} onClick={() => changeView('list')} />
          <ViewButton icon={LayoutGrid} label="Cards" active={view === 'cards'} onClick={() => changeView('cards')} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="border-t py-10 text-center text-sm text-muted-foreground">
          {projects.length ? `No project matches “${search}”.` : 'No project yet.'}
        </p>
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="-mx-6 border-t text-sm">
          <div className={`${rowGrid} h-8 border-b px-6 text-xs text-muted-foreground`}>
            <span>Name</span>
            <span>Progress</span>
            <span className="text-right">US</span>
            <span>Members</span>
            <span className="hidden md:block">Your roles</span>
          </div>
          {filtered.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  )
}

function ProjectRow({ project }: { project: Project }) {
  const progress = progressOf(project.completed, project.userStories)

  return (
    <Link
      to={`/projects/${project.id}`}
      className={`${rowGrid} h-11 border-b px-6 transition-colors hover:bg-interaction-hover active:bg-interaction-selected focus-visible:bg-interaction-hover focus-visible:outline-none`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate font-medium">{project.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{project.key}</span>
      </span>
      <span className="flex items-center gap-2 text-muted-foreground tabular-nums">
        <ProgressRing value={progress} />
        {progress} %
      </span>
      <span className="text-right text-muted-foreground tabular-nums">{project.userStories}</span>
      <span className="text-muted-foreground tabular-nums">{project.memberCount}</span>
      <span className="hidden md:block">
        <RoleBadges roles={project.myRoles} />
      </span>
    </Link>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const progress = progressOf(project.completed, project.userStories)

  return (
    <Link
      to={`/projects/${project.id}`}
      className="group flex flex-col gap-4 rounded-lg border p-4 text-sm transition-all hover:border-foreground/20 hover:bg-interaction-hover active:bg-interaction-selected hover:shadow-sm focus-visible:border-ring focus-visible:outline-none"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50">
          <FolderOpen className="size-4 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{project.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{project.key}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>{project.completed} / {project.userStories} US sent to AI</span>
          <span>{progress} %</span>
        </div>
        <Progress value={progress} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
        <span className="tabular-nums">{project.memberCount} member(s)</span>
        <RoleBadges roles={project.myRoles} />
      </div>
    </Link>
  )
}

type ViewButtonProps = {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
}

function ViewButton({ icon: Icon, label, active, onClick }: ViewButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-6 items-center justify-center rounded-sm transition-colors',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-3.5" />
    </button>
  )
}
