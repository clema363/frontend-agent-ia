import { useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useAppDispatch } from '@/lib/store'
import { atlasApi, toApiError } from '@/api/rtk-api'
import { ArrowLeft, FolderOpen, SquareKanban, Tag, User } from 'lucide-react'
import { useFieldConfig, useMe, useProjects, useStories, useStoryMutations } from '@/api/hooks'
import { ColumnIcon, IssueTypeIcon, PriorityIcon } from '@/components/kanban/issue-meta'
import { StoryDetail, StoryReview, type StoryActions } from '@/components/kanban/story-detail'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { kanbanColumns, type UserStory } from '@/lib/domain'

export function StoryPage() {
  const { storyId } = useParams()
  const location = useLocation()
  const { data: stories = [], isLoading, isError } = useStories()
  const { data: me } = useMe()
  const mutations = useStoryMutations()
  const dispatch = useAppDispatch()
  const [error, setError] = useState<string>()
  const [editing, setEditing] = useState(false)
  const story = stories.find((item) => item.id === storyId)
  const role = me?.role ?? 'PO'
  const savedReturn = location.state?.returnTo
  const returnTo = typeof savedReturn === 'string' && (savedReturn === '/kanban' || savedReturn.startsWith('/kanban?'))
    ? savedReturn
    : '/kanban'
  const onSuccess = () => setError(undefined)
  const onError = (cause: unknown) => setError(toApiError(cause).message)
  const actions: StoryActions = {
    onApprove: (id) => { void mutations.decide.trigger({ id, decision: 'approve' }).unwrap().then(onSuccess).catch(onError) },
    onComment: (id, comment) => { void mutations.decide.trigger({ id, decision: 'refuse', comment }).unwrap().then(onSuccess).catch(onError) },
    onChat: (id, message) => { void mutations.sendMessage.trigger({ id, message }).unwrap().then(onSuccess).catch(onError) },
    // Document edits remain local until a server save endpoint is available.
    onEdit: (id, stageId, markdown) => {
      dispatch(atlasApi.util.updateQueryData('getStories', undefined, (list) => {
        const story = list.find((item) => item.id === id)
        const stage = story?.stages[stageId]
        if (stage) {
          stage.markdown = markdown
          stage.editedBy = role
          stage.review = undefined
        }
      }))
    },
  }

  return (
    <>
      <PageHeader
        title={story?.key ?? 'Issue'}
        icon={SquareKanban}
        parent={{ label: 'Kanban', to: returnTo }}
        actions={
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link to={returnTo} />}>
            <ArrowLeft data-icon="inline-start" />
            Back to Kanban
          </Button>
        }
      />
      {error && <Alert variant="destructive" className="mb-6"><AlertDescription>{error}</AlertDescription></Alert>}
      {isLoading ? <p className="py-12 text-muted-foreground">Loading issue…</p> : isError ? (
        <Alert variant="destructive"><AlertDescription>Unable to load this issue. Please try again.</AlertDescription></Alert>
      ) : !story ? (
        <div className="space-y-4 py-12">
          <p>Issue not found.</p>
          <Button variant="outline" nativeButton={false} render={<Link to="/kanban" />}><ArrowLeft /> Back to Kanban</Button>
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl items-start gap-10 py-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16 lg:px-6 lg:py-10 xl:gap-24">
          <section className="min-w-0">
            <StoryDetail
              key={`${story.id}-${story.column}`}
              story={story}
              role={role}
              approving={mutations.decide.isLoading}
              onEditingChange={setEditing}
              {...actions}
            />
          </section>
          <JiraProperties
            story={story}
            review={
              <StoryReview
                story={story}
                role={role}
                approving={mutations.decide.isLoading}
                editing={editing}
                onApprove={() => actions.onApprove(story.id)}
              />
            }
          />
        </div>
      )}
    </>
  )
}

function fieldValue(value: unknown): string {
  if (value == null || value === '') return 'Not set'
  if (Array.isArray(value)) return value.length ? value.map(fieldValue).join(', ') : 'Not set'
  if (typeof value === 'object') {
    const item = value as Record<string, unknown>
    for (const key of ['displayName', 'name', 'label', 'value', 'key']) {
      if (typeof item[key] === 'string') return item[key]
    }
    return JSON.stringify(value)
  }
  return String(value)
}

function Property({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-start gap-2 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
        {icon}<span className="min-w-0 whitespace-pre-line break-words">{children}</span>
      </dd>
    </div>
  )
}

function JiraProperties({ story, review }: { story: UserStory; review: ReactNode }) {
  const { data: projects = [] } = useProjects()
  const { data: config } = useFieldConfig(story.projectId, true)
  const project = projects.find((item) => item.id === story.projectId)
  const fields = story.fields ?? {}
  const standardFields = new Set(['summary', 'description', 'status', 'issuetype', 'priority', 'project', 'assignee', 'reporter', 'labels', 'parent', 'epic-link'])
  const catalogue = config?.catalogue.flatMap((group) => group.fields) ?? []
  const extraIds = new Set([
    ...catalogue.filter((field) => config?.enabledFields.includes(field.id)).map((field) => field.id),
    ...Object.keys(fields),
  ])
  const extras = [...extraIds].filter((id) => !standardFields.has(id))

  return (
    <aside aria-label="Issue properties" className="space-y-8 border-t pt-6 lg:sticky lg:top-6 lg:border-t-0 lg:pt-2">
      <section className="space-y-4 border-b pb-6">
        <h2 className="text-sm font-medium text-muted-foreground">Agent workflow</h2>
        <dl><Property label="Current step" icon={<ColumnIcon column={story.column} />}>{kanbanColumns.find((column) => column.id === story.column)?.title}</Property></dl>
        {review}
      </section>
      <section className="space-y-5">
        <h2 className="text-sm font-medium text-muted-foreground">Jira properties</h2>
        <dl className="space-y-5">
          <Property label="Issue type" icon={<IssueTypeIcon type={story.type} />}>{story.type}</Property>
          <Property label="Status">{fieldValue(fields.status)}</Property>
          <Property label="Priority" icon={<PriorityIcon priority={story.priority} />}>{fieldValue(fields.priority ?? story.priority)}</Property>
          <Property label="Assignee" icon={<User />}>{fields.assignee ? fieldValue(fields.assignee) : 'Unassigned'}</Property>
          <Property label="Reporter" icon={<User />}>{fieldValue(fields.reporter)}</Property>
        </dl>
      </section>
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Project & labels</h2>
        <dl className="space-y-5">
          <Property label="Project" icon={<FolderOpen />}>
            {project ? <Link to={`/projects/${project.id}`} className="hover:underline">{project.name}</Link> : story.projectId}
          </Property>
          <Property label="Labels" icon={<Tag />}>{fieldValue(fields.labels)}</Property>
          {Boolean(story.parentKey || fields.parent || fields['epic-link']) && (
            <Property label="Parent issue">{fieldValue(story.parentKey ?? fields.parent ?? fields['epic-link'])}</Property>
          )}
        </dl>
      </section>
      {extras.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Additional Jira fields</h2>
          <dl className="space-y-5">
            {extras.map((id) => <Property key={id} label={catalogue.find((field) => field.id === id)?.label ?? id}>{fieldValue(fields[id])}</Property>)}
          </dl>
        </section>
      )}
    </aside>
  )
}
