import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Bot, CircleCheck, Columns3, Filter, FolderOpen, List, Loader, MessageCircleQuestion, MessageSquareText, SquareKanban, TriangleAlert, X } from 'lucide-react'
import { CodingAgentChip } from '@/components/kanban/coding-agent'
import { ColumnIcon, IssueTypeIcon, PriorityIcon } from '@/components/kanban/issue-meta'
import { NewStoryDialog, type NewStoryInput } from '@/components/kanban/new-story-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { kanbanColumnStyle, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { ApiError } from '@/api/client'
import { toApiError } from '@/api/rtk-api'
import { useJournal, useMe, useProjects, useSavePreferences, useStories, useStoryMutations, useUpdateMe } from '@/api/hooks'
import { issueTypes, kanbanColumns, roles, type NewStoryRequest, type Role, type UserStory } from '@/lib/domain'
import { canReview, stageForColumn, storyStatus } from '@/lib/story-workflow'

const ALL_PROJECTS = 'all'

type KanbanView = 'board' | 'list'

const roleOptions = roles.map((role) => ({ value: role, label: role }))
const typeOptions = [
  { value: 'all', label: 'All issue types' },
  ...issueTypes.map((type) => ({ value: type, label: type })),
]

export function KanbanPage() {
  // Kanban filters stay in the URL and are preserved when returning from a ticket.
  const [searchParams, setSearchParams] = useSearchParams()
  const { theme } = useTheme()
  const projectId = searchParams.get('project') ?? ALL_PROJECTS
  const requestedType = searchParams.get('type')
  const issueType = issueTypes.find((type) => type === requestedType) ?? 'all'
  const onlyMyReview = searchParams.get('review') === 'mine'
  const navigate = useNavigate()
  const selectedStoryId = searchParams.get('us')
  function updateParams(changes: Record<string, string | null>) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }
  function setProjectId(value: string) {
    updateParams({ project: value === ALL_PROJECTS ? null : value })
  }
  const returnParams = new URLSearchParams(searchParams)
  returnParams.delete('us')
  const returnTo = `/kanban${returnParams.size ? `?${returnParams}` : ''}`
  function openStory(id: string) {
    navigate(`/kanban/${encodeURIComponent(id)}`, { state: { returnTo } })
  }
  // The signed-in user's business role (PATCH /auth/me) determines who can approve each stage.
  const { data: me } = useMe()
  const updateMe = useUpdateMe()
  const savePreferences = useSavePreferences()
  const role = me?.role ?? 'PO'
  const [error, setError] = useState<string>()
  const { data: allStories = [] } = useStories()
  const { data: projects = [] } = useProjects()
  const mutations = useStoryMutations()
  const matchingStories = allStories.filter(
    (story) => (projectId === ALL_PROJECTS || story.projectId === projectId)
      && (issueType === 'all' || story.type === issueType),
  )
  const mineCount = matchingStories.filter((story) => canReview(story, role)).length
  const stories = onlyMyReview ? matchingStories.filter((story) => canReview(story, role)) : matchingStories
  const hasFilters = projectId !== ALL_PROJECTS || issueType !== 'all' || onlyMyReview

  const projectOptions = [
    { value: ALL_PROJECTS, label: 'All projects' },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ]

  const onError = (cause: Error) => setError(cause instanceof ApiError ? describe(cause) : cause.message)
  const onSuccess = () => setError(undefined)

  // The title, parent epic and links are not part of POST /us; links are appended to the requirement.
  function createStory(input: NewStoryInput, force = false) {
    const body: NewStoryRequest = {
      need: [input.raw, ...input.contextLinks].join('\n'),
      project: input.projectId,
      priority: input.priority,
      issueTypeName: input.type,
      force,
    }
    mutations.create.trigger(body).unwrap().then((story) => {
      onSuccess()
      openStory(story.id)
    }).catch((error: unknown) => {
      const cause = toApiError(error)
      // 409: confirm before creating a story that resembles an existing requirement.
      if (cause.status === 409 && !force) {
        if (window.confirm(`${describe(cause)}\n\nCreate the US anyway?`)) createStory(input, true)
        return
      }
      onError(cause)
    })
  }

  // Board or list view: use the URL value if present, otherwise the user's saved preference.
  const view: KanbanView = searchParams.get('view') === 'list' || (!searchParams.get('view') && me?.preferences?.kanbanView === 'list') ? 'list' : 'board'
  function setView(value: KanbanView) {
    updateParams({ view: value })
    savePreferences.trigger({ kanbanView: value })
  }

  // Comment counts per story, read from the journal.
  const { data: journal = [] } = useJournal()
  const commentCount = (story: UserStory) =>
    journal.filter((entry) => entry.usId === story.id && entry.detail && (entry.action === 'refused' || entry.action === 'rejected')).length
  const cardProps = (story: UserStory) => ({
    story,
    mine: canReview(story, role),
    comments: commentCount(story),
    onOpen: () => openStory(story.id),
  })

  // Legacy panel links redirect to the full page.
  if (selectedStoryId) {
    return <Navigate to={`/kanban/${encodeURIComponent(selectedStoryId)}`} replace state={{ returnTo }} />
  }

  return (
    <>
      <PageHeader
        title="Kanban"
        icon={SquareKanban}
        actions={<NewStoryDialog projects={projects} epics={allStories.filter((story) => story.type === 'Epic')} onCreate={createStory} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select items={projectOptions} value={projectId} onValueChange={(value) => setProjectId(value ?? ALL_PROJECTS)}>
          <SelectTrigger className="w-52 justify-start hover:bg-interaction-hover data-popup-open:bg-interaction-selected" aria-label="Project">
            <FolderOpen className="text-muted-foreground" aria-hidden="true" />
            <SelectValue className="flex-1 text-left" />
          </SelectTrigger>
          <SelectContent className="[&_[role=listbox]]:flex [&_[role=listbox]]:flex-col [&_[role=listbox]]:gap-[2px] [&_[role=listbox]]:p-[2px]">
            {projectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} className="focus:bg-interaction-hover data-highlighted:bg-interaction-hover data-selected:bg-interaction-selected">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={roleOptions} value={role} onValueChange={(value) => value && updateMe.trigger({ role: value as Role })}>
          <SelectTrigger className="w-36 justify-start" aria-label="View as">
            <span className="text-muted-foreground">View as</span>
            <SelectValue className="flex-1 text-left" />
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
          items={typeOptions}
          value={issueType}
          onValueChange={(value) => updateParams({ type: !value || value === 'all' ? null : value })}
        >
          <SelectTrigger className="w-40 justify-start" aria-label="Issue type">
            <Filter className="text-muted-foreground" aria-hidden="true" />
            <SelectValue className="flex-1 text-left" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.value !== 'all' && <IssueTypeIcon type={option.value as UserStory['type']} />}
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Toggle
          variant="outline"
          pressed={onlyMyReview}
          onPressedChange={(pressed) => updateParams({ review: pressed ? 'mine' : null })}
          aria-label="Your review"
          title={`Documents ready for validation as ${role}`}
        >
          <CircleCheck />
          Your review
          <span className="text-xs text-muted-foreground tabular-nums">{mineCount}</span>
        </Toggle>
        <span className="text-xs text-muted-foreground tabular-nums">
          {stories.length} US{mineCount > 0 && <> · <span className="text-primary">{mineCount} waiting for you</span></>}
        </span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => updateParams({ project: null, type: null, review: null })}>
            <X />
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex items-center rounded-lg border p-0.5" role="group" aria-label="Display">
          <Toggle size="sm" pressed={view === 'board'} onPressedChange={() => setView('board')} aria-label="Board view">
            <Columns3 />
            Board
          </Toggle>
          <Toggle size="sm" pressed={view === 'list'} onPressedChange={() => setView('list')} aria-label="List view">
            <List />
            List
          </Toggle>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasFilters && stories.length === 0 && (
        <p role="status" className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No tickets match these filters{onlyMyReview ? ` for your role (${role})` : ''}. Change or clear the filters to see more tickets.
        </p>
      )}

      {view === 'board' ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {kanbanColumns.map((column) => {
            const columnStories = stories.filter((story) => story.column === column.id)
            return (
              <section
                key={column.id}
                className="flex min-h-96 flex-col gap-2 rounded-xl bg-muted/40 p-2"
                style={kanbanColumnStyle(theme.kanbanColumns[column.id])}
              >
                <ColumnHeader column={column} count={columnStories.length} className="px-1.5 py-1" />
                {columnStories.map((story) => (
                  <StoryCard key={story.id} {...cardProps(story)} />
                ))}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {kanbanColumns.map((column) => {
            const columnStories = stories.filter((story) => story.column === column.id)
            return (
              <section key={column.id}>
                <ColumnHeader column={column} count={columnStories.length} className="h-9 rounded-md bg-muted/50 px-3" showAgent />
                {columnStories.length > 0 && (
                  <ul className="divide-y">
                    {columnStories.map((story) => (
                      <StoryRow key={story.id} {...cardProps(story)} project={projects.find((item) => item.id === story.projectId)?.name} />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

    </>
  )
}

type Column = (typeof kanbanColumns)[number]

function ColumnHeader({ column, count, className, showAgent }: { column: Column; count: number; className?: string; showAgent?: boolean }) {
  return (
    <h2 className={cn('flex items-center gap-2 text-sm font-medium', className)}>
      <ColumnIcon column={column.id} />
      {column.title}
      <span className="font-normal text-muted-foreground tabular-nums">{count}</span>
      {showAgent ? (
        <span className="ml-2 flex items-center gap-1 text-xs font-normal text-muted-foreground">
          <Bot className="size-3.5" aria-hidden="true" />
          {column.agent}
        </span>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={<span className="ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" />}
            aria-label={column.agent}
          >
            <Bot className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{column.agent}</TooltipContent>
        </Tooltip>
      )}
    </h2>
  )
}

type StoryItemProps = {
  story: UserStory
  // The current stage document is awaiting approval from the selected role.
  mine: boolean
  comments: number
  onOpen: () => void
}

function StoryCard({ story, mine, comments, onOpen }: StoryItemProps) {
  return (
    <Card size="sm" className="relative gap-2 text-foreground transition-shadow hover:shadow-md hover:ring-foreground/20">
      {mine && <span className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-primary" aria-hidden="true" />}
      <CardHeader className="gap-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono">{story.key}</span>
          <PriorityIcon priority={story.priority} className="ml-auto" />
        </div>
        <CardTitle className="line-clamp-2 leading-snug font-medium">
          {/* The button's expanded pseudo-element makes the entire card clickable. */}
          <button
            type="button"
            onClick={onOpen}
            className="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {story.title}
          </button>
        </CardTitle>
        <div className="flex min-h-5 items-center gap-2.5">
          <IssueTypeIcon type={story.type} />
          <StoryIndicators story={story} mine={mine} comments={comments} />
        </div>
      </CardHeader>
    </Card>
  )
}

function StoryRow({ story, mine, comments, onOpen, project }: StoryItemProps & { project?: string }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex h-10 w-full items-center gap-3 px-3 text-left text-sm transition-colors hover:bg-muted/50">
        <span className={cn('size-1.5 shrink-0 rounded-full', mine ? 'bg-primary' : 'bg-transparent')} aria-hidden="true" />
        <PriorityIcon priority={story.priority} />
        <IssueTypeIcon type={story.type} />
        <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{story.key}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{story.title}</span>
        <span className="flex shrink-0 items-center gap-2.5">
          <StoryIndicators story={story} mine={mine} comments={comments} />
        </span>
        {project && <span className="hidden w-40 shrink-0 truncate text-right text-xs text-muted-foreground md:block">{project}</span>}
      </button>
    </li>
  )
}

// Story indicators: current stage status, comments, approvers and coding agent.
function StoryIndicators({ story, mine, comments }: Omit<StoryItemProps, 'onOpen'>) {
  const stage = stageForColumn(story.column)
  const status = storyStatus(story)

  return (
    <>
      {status === 'needs-input' && (
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-px text-xs text-primary" title={`${stage?.agent} has questions for you`}>
          <MessageCircleQuestion className="size-3.5" aria-hidden="true" />
          Questions
        </span>
      )}
      {status === 'agent-working' && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground" title={`${stage?.agent} is working`}>
          <Loader className="size-3.5 animate-spin" aria-hidden="true" />
          Agent
        </span>
      )}
      {comments > 0 && (
        <span
          className={cn('flex items-center gap-1 text-xs tabular-nums', status === 'changes-requested' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}
          title={status === 'changes-requested' ? 'Changes requested' : `${comments} comments`}
        >
          <MessageSquareText className="size-3.5" aria-hidden="true" />
          {comments}
        </span>
      )}
      {status === 'changes-requested' && comments === 0 && (
        <MessageSquareText className="size-3.5 text-amber-700 dark:text-amber-400" aria-label="Changes requested" />
      )}
      {story.codingAgent && <CodingAgentChip run={story.codingAgent} />}
      {status === 'to-review' && stage && (
        <span className={cn('ml-auto text-xs', mine ? 'font-medium text-primary' : 'text-muted-foreground')} title={`Validation by ${stage.approvers.join(' or ')}`}>
          {mine ? 'Your review' : stage.approvers.join(' · ')}
        </span>
      )}
    </>
  )
}

function describe(error: ApiError) {
  const detail = error.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'message' in detail) return String(detail.message)
  return `Request failed (${error.status})`
}
