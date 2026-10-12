import type { ReactNode } from 'react'
import { ArrowRight, Bot, CircleCheck, CircleX, CopyCheck, Inbox, LayoutDashboard, Send, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useHealth, useJournal, useMe, useProjects, useStats, useStories } from '@/api/hooks'
import { IssueTypeIcon, PriorityIcon } from '@/components/kanban/issue-meta'
import { PageHeader } from '@/components/layout/page-header'
import { ProgressRing } from '@/components/progress-ring'
import { SectionHeader } from '@/components/projects/project-parts'
import { journalActionLabels, kanbanColumns, stages, type JournalEntry, type Project, type UserStory } from '@/lib/domain'
import { canReview, stageForColumn, storyStatus } from '@/lib/story-workflow'
import { cn, progressOf, timeAgo } from '@/lib/utils'

// Lien vers la page complète du ticket.
const storyUrl = (story: UserStory) => `/kanban/${encodeURIComponent(story.id)}`

export function DashboardPage() {
  const { data: me } = useMe()
  const { data: stories = [] } = useStories()
  const { data: projects = [] } = useProjects()
  const role = me?.role ?? 'PO'

  const toReview = stories.filter((story) => canReview(story, role))
  const count = (status: ReturnType<typeof storyStatus>) => stories.filter((story) => storyStatus(story) === status).length

  return (
    <>
      <PageHeader title="Dashboard" icon={LayoutDashboard} />

      <div className="mx-auto w-full max-w-6xl space-y-6">
        <HealthWarning />

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
          <Kpi icon={Inbox} label="To review by you" value={toReview.length} hint={`as ${role}`} to="/kanban" accent />
          <Kpi icon={CircleX} label="Changes requested" value={count('changes-requested')} hint="reworked by the agents" to="/kanban" />
          <Kpi icon={Bot} label="Agents working" value={count('agent-working')} hint="document in progress" to="/kanban" />
          <Kpi icon={Send} label="Sent to AI" value={count('sent-to-ai')} hint="ready for development" to="/kanban" />
        </dl>

        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <section className="space-y-3">
              <SectionHeader title="Waiting for you" count={toReview.length} actions={
                <Link to="/kanban" className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                  All tickets
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              }>
                Documents ready for your validation as <strong className="font-medium text-foreground">{role}</strong>.
              </SectionHeader>
              {toReview.length ? (
                <ul className="divide-y rounded-lg border text-sm">
                  {toReview.slice(0, 4).map((story) => (
                    <ReviewRow key={story.id} story={story} project={projects.find((item) => item.id === story.projectId)} />
                  ))}
                </ul>
              ) : (
                <EmptyState icon={CircleCheck}>Nothing to validate. You're all caught up.</EmptyState>
              )}
            </section>

            <section className="space-y-3">
              <SectionHeader
                title="Projects"
                count={projects.length}
                actions={
                  <Link to="/projects" className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                    All projects
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                }
              />
              <ul className="divide-y rounded-lg border text-sm">
                {projects.slice(0, 4).map((project) => (
                  <ProjectRow key={project.id} project={project} stories={stories.filter((story) => story.projectId === project.id)} />
                ))}
              </ul>
            </section>
          </div>
          <div className="min-w-0 space-y-6">
            <Activity stories={stories} />
            <Duplicates />
          </div>
        </div>
      </div>
    </>
  )
}

// Rien quand tout va bien : l'encart n'apparaît que si le serveur n'a pas de modèle configuré.
function HealthWarning() {
  const { data: health } = useHealth()
  if (!health || health.llmConfigured) return null
  return (
    <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <TriangleAlert className="size-4" aria-hidden="true" />
      No LLM configured on the server: the agents cannot run.
      <Link to="/settings" className="ml-auto font-medium hover:underline">
        Settings
      </Link>
    </p>
  )
}

type KpiProps = {
  icon: LucideIcon
  label: string
  value: number
  hint: string
  to: string
  accent?: boolean
}

function Kpi({ icon: Icon, label, value, hint, to, accent }: KpiProps) {
  return (
    <Link to={to} className="group bg-background p-4 transition-colors hover:bg-muted/40">
      <dt className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn('size-3.5', accent && value > 0 && 'text-primary')} aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-2 flex items-baseline gap-2">
        <span className={cn('text-2xl font-semibold tabular-nums', accent && value > 0 && 'text-primary')}>{value}</span>
        <span className="truncate text-xs text-muted-foreground">{hint}</span>
      </dd>
    </Link>
  )
}

function ReviewRow({ story, project }: { story: UserStory; project?: Project }) {
  const stage = stageForColumn(story.column)

  return (
    <li>
      <Link to={storyUrl(story)} className="flex h-11 items-center gap-3 px-4 transition-colors hover:bg-muted/50">
        <PriorityIcon priority={story.priority} />
        <IssueTypeIcon type={story.type} />
        <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{story.key}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{story.title}</span>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{project?.name}</span>
        {stage && <span className="shrink-0 rounded border px-1.5 py-px text-[11px] leading-4 text-muted-foreground">{stage.label}</span>}
      </Link>
    </li>
  )
}

function Activity({ stories }: { stories: UserStory[] }) {
  const { data: journal = [] } = useJournal()
  const entries = [...journal].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4)

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Recent activity"
        actions={
          <Link to="/journal" className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
            Journal
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      />
      {entries.length ? (
        <ol className="space-y-3 border-l pl-4 text-sm">
          {entries.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} story={stories.find((story) => story.id === entry.usId)} />
          ))}
        </ol>
      ) : (
        <EmptyState icon={Inbox}>No activity yet.</EmptyState>
      )}
    </section>
  )
}

function ActivityItem({ entry, story }: { entry: JournalEntry; story?: UserStory }) {
  const stage = stages.find((item) => item.id === entry.stage)

  return (
    <li className="relative">
      <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full border-2 border-background bg-muted-foreground/40" aria-hidden="true" />
      <p className="line-clamp-2" title={`${entry.actor} ${journalActionLabels[entry.action] ?? entry.action} ${story?.key ?? entry.usId}${stage ? ` · ${stage.label}` : ''}`}>
        <span className="font-medium">{entry.actor}</span>{' '}
        <span className="text-muted-foreground">{journalActionLabels[entry.action] ?? entry.action}</span>{' '}
        {story ? (
          <Link to={storyUrl(story)} className="font-mono text-xs hover:underline">
            {story.key}
          </Link>
        ) : (
          <span className="font-mono text-xs">{entry.usId}</span>
        )}
        {stage && <span className="text-muted-foreground"> · {stage.label}</span>}
      </p>
      {entry.detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.detail}</p>}
      <time dateTime={entry.at} className="text-xs text-muted-foreground">
        {timeAgo(entry.at)}
      </time>
    </li>
  )
}

function ProjectRow({ project, stories }: { project: Project; stories: UserStory[] }) {
  const progress = progressOf(project.completed, project.userStories)

  return (
    <li>
      <Link to={`/projects/${project.id}`} className="flex h-12 items-center gap-4 px-4 transition-colors hover:bg-muted/50">
        <ProgressRing value={progress} />
        <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
        {/* Répartition des US par colonne du Kanban, de la création à l'envoi à l'IA. */}
        <span className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-muted sm:flex" title="US per board column">
          {kanbanColumns.map((column) => {
            const count = stories.filter((story) => story.column === column.id).length
            return (
              <span
                key={column.id}
                className="h-full"
                style={{
                  width: stories.length ? `${(count / stories.length) * 100}%` : 0,
                  backgroundColor: column.color,
                }}
              />
            )
          })}
        </span>
        <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">{stories.length} US</span>
      </Link>
    </li>
  )
}

function Duplicates() {
  const { data: stats } = useStats()

  return (
    <section className="space-y-3">
      <SectionHeader title="Duplicate prevention">Needs checked against existing US and Jira tickets.</SectionHeader>
      <dl className="divide-y rounded-lg border text-sm">
        <StatRow icon={CopyCheck} label="Needs flagged as duplicates" value={stats?.flaggedNeeds} />
        <StatRow icon={TriangleAlert} label="US created despite a warning" value={stats?.createdDespiteWarnings} />
      </dl>
    </section>
  )
}

function StatRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: number }) {
  return (
    <div className="flex h-11 items-center gap-3 px-4">
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <dt className="flex-1 text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value ?? '–'}</dd>
    </div>
  )
}

function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </p>
  )
}
