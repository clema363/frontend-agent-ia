import { useState, type ReactNode } from 'react'
import type * as React from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Bot, CircleCheck, Columns3, Filter, FolderOpen, GitPullRequest, List, Loader, MessageCircleQuestion, MessageSquareText, Plus, SquareKanban, TriangleAlert, X } from 'lucide-react'
import { AgentAvatar, CodingAgentChip } from '@/components/kanban/coding-agent'
import { ColumnIcon, IssueTypeDot, IssueTypeIcon, PriorityBars, PriorityIcon } from '@/components/kanban/issue-meta'
import { NewStoryDialog, type NewStoryInput } from '@/components/kanban/new-story-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
  const projectName = (story: UserStory) => projects.find((item) => item.id === story.projectId)?.name
  const cardProps = (story: UserStory) => ({
    story,
    mine: canReview(story, role),
    comments: commentCount(story),
    onOpen: () => openStory(story.id),
  })

  const newStoryDialog = (trigger?: React.ReactElement) => (
    <NewStoryDialog projects={projects} epics={allStories.filter((story) => story.type === 'Epic')} onCreate={createStory} trigger={trigger} />
  )

  // Legacy panel links redirect to the full page.
  if (selectedStoryId) {
    return <Navigate to={`/kanban/${encodeURIComponent(selectedStoryId)}`} replace state={{ returnTo }} />
  }

  return (
    <>
      <PageHeader title="Kanban" icon={SquareKanban} actions={newStoryDialog()} />

      {/* Full-height page: only the columns (or the list) scroll, the filters stay in place. */}
      <div className="flex min-h-0 flex-1 flex-col px-6 pt-6 pb-4">
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
          // Linear-style board: fixed-width columns that scroll horizontally, flat cards.
          <div className="-mx-1 mt-4 flex min-h-0 flex-1 gap-3 overflow-x-auto px-1 pb-1">
            {kanbanColumns.map((column, index) => {
              const columnStories = stories.filter((story) => story.column === column.id)
              return (
                <section
                  key={column.id}
                  className="flex min-h-0 w-80 shrink-0 flex-col rounded-xl p-1"
                  style={kanbanColumnStyle(theme.kanbanColumns[column.id])}
                >
                  <ColumnHeader
                    column={column}
                    count={columnStories.length}
                    className="h-9 px-2"
                    // New stories always start in the first column.
                    add={index === 0 ? newStoryDialog(<ColumnButton label="New US"><Plus /></ColumnButton>) : undefined}
                  />
                  <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-1 pt-2 pb-1">
                    {columnStories.map((story) => (
                      <StoryCard key={story.id} {...cardProps(story)} project={projectName(story)} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-6">
            {kanbanColumns.map((column) => {
              const columnStories = stories.filter((story) => story.column === column.id)
              return (
                <section key={column.id}>
                  <ColumnHeader column={column} count={columnStories.length} className="h-9 rounded-md bg-muted/50 px-3" showAgent />
                  {columnStories.length > 0 && (
                    <ul className="divide-y">
                      {columnStories.map((story) => (
                        <StoryRow key={story.id} {...cardProps(story)} project={projectName(story)} />
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        )}
        </div>
      </>
    )
  }

  type Column = (typeof kanbanColumns)[number]

  function ColumnHeader({ column, count, className, showAgent, add }: { column: Column; count: number; className?: string; showAgent?: boolean; add?: ReactNode }) {
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
          <span className="ml-auto flex items-center gap-0.5">
            {add}
            <Tooltip>
              <TooltipTrigger render={<ColumnButton label={column.agent} />}>
                <Bot />
              </TooltipTrigger>
              <TooltipContent>{column.agent}</TooltipContent>
            </Tooltip>
          </span>
        )}
      </h2>
    )
  }

  function ColumnButton({ label, ...props }: React.ComponentProps<'button'> & { label: string }) {
    return (
      <button
        type="button"
        aria-label={label}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-3.5"
        {...props}
      />
    )
  }

  type StoryItemProps = {
    story: UserStory
    // The current stage document is awaiting approval from the selected role.
    mine: boolean
    comments: number
    onOpen: () => void
  }

  function StoryCard({ story, mine, comments, onOpen, project }: StoryItemProps & { project?: string }) {
    return (
      <article
        className={cn(
          'relative flex flex-col gap-1 rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-xs transition-colors hover:border-foreground/20 hover:bg-muted/30',
          mine && 'border-primary/40',
        )}
      >
        <div className="flex h-5 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0">{story.key}</span>
          {story.parentKey && (
            <span className="truncate">
              <span aria-hidden="true">›</span> {story.parentKey}
            </span>
          )}
          <StoryAssignee story={story} mine={mine} className="ml-auto" />
        </div>
        <h3 className="line-clamp-2 leading-snug font-medium">
          {/* The button's expanded pseudo-element makes the entire card clickable. */}
          <button
            type="button"
            onClick={onOpen}
            className="text-left after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {story.title}
          </button>
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Chip className="px-1" title={`${story.priority} priority`}>
            <PriorityBars priority={story.priority} />
          </Chip>
          <Chip>
            <IssueTypeDot type={story.type} />
            {story.type}
          </Chip>
          {project && (
            <Chip className="max-w-36">
              <FolderOpen className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{project}</span>
            </Chip>
          )}
          <StoryIndicators story={story} mine={mine} comments={comments} chips />
      </div>
    </article>
  )
}

// Bordered label chip, like Linear card labels.
function Chip({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[11px] whitespace-nowrap text-muted-foreground', className)}
      {...props}
    />
  )
}

// Top-right "assignee": the stage agent while it works, otherwise the roles expected to approve.
function StoryAssignee({ story, mine, className }: { story: UserStory; mine: boolean; className?: string }) {
  const stage = stageForColumn(story.column)
  const status = storyStatus(story)
  if (story.codingAgent || status === 'agent-working' || status === 'needs-input') {
    const working = status === 'agent-working' || story.codingAgent?.status === 'working'
    return (
      <span className={cn('relative', className)} title={stage?.agent ?? story.codingAgent?.agent}>
        <AgentAvatar />
        {working && <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border border-card bg-green-500" />}
      </span>
    )
  }
  if (status === 'to-review' && stage) {
    return (
      <span
        className={cn(
          'flex size-5 items-center justify-center rounded-full text-[9px] font-semibold',
          mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          className,
        )}
        title={`Validation by ${stage.approvers.join(' or ')}`}
      >
        {stage.approvers[0].slice(0, 2).toUpperCase()}
      </span>
    )
  }
  return null
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
function StoryIndicators({ story, mine, comments, chips }: Omit<StoryItemProps, 'onOpen'> & { chips?: boolean }) {
  const stage = stageForColumn(story.column)
  const status = storyStatus(story)

  // Card variant: the same information as bordered chips; the agent and approvers are shown as the assignee.
  if (chips) {
    return (
      <>
        {status === 'needs-input' && (
          <Chip className="border-primary/30 text-primary" title={`${stage?.agent} has questions for you`}>
            <MessageCircleQuestion className="size-3" aria-hidden="true" />
            Questions
          </Chip>
        )}
        {status === 'agent-working' && (
          <Chip title={`${stage?.agent} is working`}>
            <Loader className="size-3 animate-spin" aria-hidden="true" />
            Agent
          </Chip>
        )}
        {(comments > 0 || status === 'changes-requested') && (
          <Chip
            className={cn('tabular-nums', status === 'changes-requested' && 'text-amber-700 dark:text-amber-400')}
            title={status === 'changes-requested' ? 'Changes requested' : `${comments} comments`}
          >
            <MessageSquareText className="size-3" aria-hidden="true" />
            {comments > 0 ? comments : 'Changes'}
          </Chip>
        )}
        {story.codingAgent?.pullRequest && (
          <Chip title={`${story.codingAgent.agent} · merge request`}>
            <GitPullRequest className="size-3" aria-hidden="true" />
            !{story.codingAgent.pullRequest.number}
          </Chip>
        )}
        {status === 'to-review' && mine && (
          <Chip className="border-primary/30 text-primary">
            <CircleCheck className="size-3" aria-hidden="true" />
            Your review
          </Chip>
        )}
      </>
    )
  }

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
