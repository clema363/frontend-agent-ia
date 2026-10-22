import { useState, type ReactNode } from 'react'
import { ArrowRight, Ellipsis, FolderOpen, SquareKanban, Trash2 } from 'lucide-react'
import { Link, NavLink, useNavigate, useParams } from 'react-router'
import { useMe, useProjectMutations, useProjects, useStories } from '@/api/hooks'
import { PageHeader } from '@/components/layout/page-header'
import { ProgressRing } from '@/components/progress-ring'
import { DeleteProjectDialog } from '@/components/projects/delete-project-dialog'
import { ProjectContext } from '@/components/projects/project-context'
import { ProjectJiraFields } from '@/components/projects/project-jira-fields'
import { ProjectMembers } from '@/components/projects/project-members'
import { RoleBadges, SectionHeader } from '@/components/projects/project-parts'
import { ProjectSkills } from '@/components/projects/project-skills'
import { SourcesSection } from '@/components/projects/project-sources'
import { buttonVariants } from '@/components/ui/button-variants'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ColumnIcon } from '@/components/kanban/issue-meta'
import { kanbanColumns, type Project } from '@/lib/domain'
import { cn, progressOf } from '@/lib/utils'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'fields', label: 'Jira fields' },
  { id: 'context', label: 'Context' },
  { id: 'skills', label: 'Skills' },
] as const

type TabId = (typeof tabs)[number]['id']

// Centered reading column shared by tabs and their content.
const column = 'mx-auto w-full max-w-4xl'

// Project page: /projects/:projectId/:tab? with one tab per configuration topic.
export function ProjectPage() {
  const { projectId = '', tab = 'overview' } = useParams()
  const { data: projects, isLoading } = useProjects()
  const { data: me } = useMe()
  const { delete: deleteProject } = useProjectMutations()
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const project = projects?.find((item) => item.id === projectId)
  const boardUrl = `/kanban?project=${projectId}`

  if (!project) {
    return (
      <>
        <PageHeader title={isLoading ? '…' : 'Not found'} icon={FolderOpen} parent={{ label: 'Projects', to: '/projects' }} />
        {!isLoading && (
          <p className="text-sm text-muted-foreground">
            This project does not exist or you are not a member. <Link to="/projects" className="text-primary hover:underline">Back to projects</Link>
          </p>
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={project.name}
        icon={FolderOpen}
        parent={{ label: 'Projects', to: '/projects' }}
        actions={
          <>
            <Link to={boardUrl} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <SquareKanban data-icon="inline-start" />
              Open board
            </Link>
            {me?.isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Project actions" />}>
                  <Ellipsis />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
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
      <nav aria-label="Project sections" className="-mx-6 -mt-6 mb-8 h-10 border-b px-6">
        {/* Use the same centered column as the content to align the tabs. */}
        <div className={`${column} flex h-full items-stretch gap-1`}>
          {tabs.map((item) => (
            <NavLink
              key={item.id}
              to={item.id === 'overview' ? `/projects/${project.id}` : `/projects/${project.id}/${item.id}`}
              end
              className={({ isActive }) =>
                cn(
                  '-mb-px flex items-center border-b-2 px-2 text-sm transition-colors first:-ml-2',
                  isActive
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div key={tab} className={`${column} animate-in fade-in-0 duration-200`}>
        <ProjectTab tab={tab as TabId} project={project} boardUrl={boardUrl} />
      </div>

      <DeleteProjectDialog
        project={project}
        open={deleting}
        onOpenChange={setDeleting}
        onDelete={(id) => deleteProject.trigger(id).unwrap().then(() => navigate('/projects')).catch(() => undefined)}
      />
    </>
  )
}

function ProjectTab({ tab, project, boardUrl }: { tab: TabId; project: Project; boardUrl: string }) {
  switch (tab) {
    case 'members':
      return <ProjectMembers project={project} />
    case 'fields':
      return <ProjectJiraFields project={project} />
    case 'context':
      return <ProjectContext project={project} />
    case 'skills':
      return <ProjectSkills project={project} />
    default:
      return <ProjectOverview project={project} boardUrl={boardUrl} />
  }
}

function ProjectOverview({ project, boardUrl }: { project: Project; boardUrl: string }) {
  const { data: stories = [] } = useStories()
  const projectStories = stories.filter((story) => story.projectId === project.id)
  const progress = progressOf(project.completed, project.userStories)

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg border bg-muted/50">
            <FolderOpen className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{project.name}</h2>
            <p className="font-mono text-xs text-muted-foreground">{project.key}</p>
          </div>
        </div>

        {/* Project properties on one row, similar to a Linear project header. */}
        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Property label="Progress">
            <span className="flex items-center gap-2 tabular-nums">
              <ProgressRing value={progress} />
              {progress} %
            </span>
          </Property>
          <Property label="User stories">
            <span className="tabular-nums">
              {project.userStories} <span className="text-muted-foreground">· {project.completed} sent to AI</span>
            </span>
          </Property>
          <Property label="Members">
            <Link to={`/projects/${project.id}/members`} className="tabular-nums hover:underline">
              {project.memberCount}
            </Link>
          </Property>
          <Property label="Your roles">
            <RoleBadges roles={project.myRoles} />
          </Property>
        </dl>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Pipeline"
          count={projectStories.length}
          actions={
            <Link to={boardUrl} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              Open board
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          Where the user stories of this project stand.
        </SectionHeader>
        <ul className="divide-y rounded-lg border text-sm">
          {kanbanColumns.map((column) => {
            const count = projectStories.filter((story) => story.column === column.id).length
            const share = projectStories.length ? (count / projectStories.length) * 100 : 0
            return (
              <li key={column.id}>
                <Link to={boardUrl} className="flex h-10 items-center gap-4 px-4 transition-colors hover:bg-muted/50">
                  <span className="flex w-36 shrink-0 items-center gap-2 font-medium">
                    <ColumnIcon column={column.id} />
                    {column.title}
                  </span>
                  <span className="hidden w-36 shrink-0 text-xs text-muted-foreground sm:block">{column.agent}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${share}%`, backgroundColor: column.color }} />
                  </span>
                  <span className="w-6 text-right text-muted-foreground tabular-nums">{count}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <SourcesSection project={project} />
    </div>
  )
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
