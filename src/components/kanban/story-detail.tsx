import { useEffect, useRef, useState, type Ref } from 'react'
import {
  ArrowUp,
  Bot,
  CircleCheck,
  ExternalLink,
  Loader,
  MessageSquareText,
  Pencil,
} from 'lucide-react'
import { AgentAvatar, CodingAgentPanel } from '@/components/kanban/coding-agent'
import { ApproveStoryDialog } from '@/components/kanban/approve-story-dialog'
import { IssueTypeIcon, PriorityIcon } from '@/components/kanban/issue-meta'
import { Markdown } from '@/components/markdown'
import { UserAvatar } from '@/components/projects/project-parts'
import { SourceList } from '@/components/source-badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { diffLines } from '@/lib/diff'
import { useJournal, useSettings } from '@/api/hooks'
import { stages, type Role, type StageId, type StageOutput, type UserStory } from '@/lib/domain'
import { stageForColumn } from '@/lib/story-workflow'
import { cn, timeAgo } from '@/lib/utils'

// One tab per stage, plus the coding agent tab once the plan has been sent.
type Tab = StageId | 'agent'

export type StoryActions = {
  // decide and messages always target the story's current stage.
  onApprove: (storyId: string) => void
  // A comment returns the current stage document for revision (rejection in backend terms).
  onComment: (storyId: string, comment: string) => void
  onEdit: (storyId: string, stageId: StageId, markdown: string) => void
  onChat: (storyId: string, message: string) => void
}

type StoryDetailProps = StoryActions & {
  story: UserStory
  role: Role
  approving?: boolean
  // Lets the page block approval while the document has unsaved edits.
  onEditingChange?: (editing: boolean) => void
}

export function StoryDetail({ story, role, approving = false, onEditingChange, ...actions }: StoryDetailProps) {
  const currentStage = stageForColumn(story.column)
  const jiraUrl = useSettings().data?.jiraUrl
  const sentToAi = story.column === 'sent-to-ai'
  const [tab, setTab] = useState<Tab>(sentToAi ? 'agent' : (currentStage?.id ?? 'plan'))
  const stageTab: StageId = tab === 'agent' ? 'plan' : tab
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [showChanges, setShowChanges] = useState(false)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  const stage = stages.find((item) => item.id === stageTab) ?? stages[0]
  const output = tab === 'agent' ? undefined : story.stages[stageTab]
  const isCurrent = currentStage?.id === tab
  const canValidate = stage.approvers.includes(role)
  const previousOutput = tab === 'refinement' ? story.stages.authoring : undefined

  useEffect(() => {
    onEditingChange?.(editing)
    return () => onEditingChange?.(false)
  }, [editing, onEditingChange])

  function changeTab(value: Tab) {
    setTab(value)
    setEditing(false)
    setShowChanges(false)
  }

  function startEditing() {
    setDraft(output?.markdown ?? '')
    setEditing(true)
  }

  function saveEdit() {
    actions.onEdit(story.id, stageTab, draft)
    setEditing(false)
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-col gap-2 pb-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <IssueTypeIcon type={story.type} />
          <span>{story.type}</span>
          <span className="font-mono">{story.key}</span>
          <PriorityIcon priority={story.priority} />
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<a href={`${jiraUrl}/browse/${story.key}`} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink data-icon="inline-start" />
              Open in Jira
            </Button>

          </div>
        </div>
        <h2 className="mt-3 text-3xl leading-snug font-semibold tracking-tight">{story.title}</h2>

        <Tabs value={tab} onValueChange={(value) => changeTab(value as Tab)} className="pt-2">
          <TabsList className="w-full">
            {stages.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                <StageStatusIcon output={story.stages[item.id]} isCurrent={currentStage?.id === item.id} />
                {item.label}
              </TabsTrigger>
            ))}
            {sentToAi && (
              <TabsTrigger value="agent">
                <AgentAvatar className="size-4 [&_svg]:size-2.5" />
                Coding agent
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 space-y-6 pb-8">
        {tab === 'authoring' && <RawInput story={story} />}

        {tab === 'agent' ? (
          <CodingAgentPanel run={story.codingAgent} />
        ) : !output ? (
          <AgentWorking agent={stage.agent} isCurrent={isCurrent} />
        ) : (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Bot className="size-3.5" aria-hidden="true" />
                  {stage.agent}
                  {output.editedBy && <span>· edited by {output.editedBy}</span>}
                  {output.review && (
                    <span>· {output.review.decision === 'approved' ? 'approved' : 'changes requested'} by {output.review.by}</span>
                  )}
                </h3>
                {!editing && (
                  <div className="flex items-center gap-2">
                    {previousOutput && (
                      <Button variant="outline" size="xs" onClick={() => setShowChanges((value) => !value)}>
                        {showChanges ? 'Show document' : 'Show changes'}
                      </Button>
                    )}
                    {isCurrent && (
                      <Button variant="outline" size="xs" onClick={startEditing} disabled={!canValidate || approving}>
                        <Pencil data-icon="inline-start" />
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {editing ? (
                <div className="space-y-2">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="min-h-80 font-mono text-xs"
                    aria-label="Document in Markdown"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveEdit}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : showChanges && previousOutput ? (
                <StoryDiff before={previousOutput.markdown} after={output.markdown} />
              ) : (
                <div className="py-4">
                  <Markdown>{output.markdown}</Markdown>
                </div>
              )}
            </section>

            {output.sources.length > 0 && (
              <section className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="pt-0.5">Sources</span>
                <SourceList sources={output.sources} />
              </section>
            )}

            <Comments
              story={story}
              stageId={stageTab}
              canComment={isCurrent && !editing}
              onComment={(text) => actions.onComment(story.id, text)}
            />

            {output.chat.length > 0 && <ChatThread output={output} />}
          </>
        )}
      </div>

      {output && isCurrent && (
        // Pinned to the bottom of the page scroller, like a chat composer.
        // Sticky offsets start inside the scroller's pb-10, so -bottom-10 and
        // -mb-10 cancel that padding and let the bar sit flush with the edge.
        <div className="sticky -bottom-10 z-10 -mb-10 bg-linear-to-t from-background from-75% to-transparent pt-6 pb-3">
          <ChatInput
            inputRef={chatInputRef}
            agent={stage.agent}
            onSend={(text) => actions.onChat(story.id, text)}
          />
        </div>
      )}
    </div>
  )
}

function StageStatusIcon({ output, isCurrent }: { output?: StageOutput; isCurrent: boolean }) {
  if (output?.review?.decision === 'approved') {
    return <CircleCheck className="text-green-600 dark:text-green-400" aria-label="Approved" />
  }
  if (output?.review?.decision === 'rejected') {
    return <MessageSquareText className="text-amber-600 dark:text-amber-400" aria-label="Changes requested" />
  }
  if (isCurrent) {
    return <span className="size-2 rounded-full bg-primary" aria-label="Current step" />
  }
  return null
}

function RawInput({ story }: { story: UserStory }) {
  return (
    <section className="space-y-2 rounded-lg bg-muted/50 p-3">
      <h3 className="text-xs font-medium text-muted-foreground">Raw input</h3>
      <p className="whitespace-pre-line">{story.raw}</p>
      {story.contextLinks.length > 0 && (
        <ul className="space-y-1 text-xs">
          {story.contextLinks.map((link) => (
            <li key={link}>
              <a href={link} target="_blank" rel="noreferrer" className="break-all text-primary underline">
                {link}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AgentWorking({ agent, isCurrent }: { agent: string; isCurrent: boolean }) {
  return (
    <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-muted-foreground">
      {isCurrent ? (
        <>
          <Loader className="size-4 animate-spin" aria-hidden="true" />
          {agent} is working on this step…
        </>
      ) : (
        'The story has not reached this step yet.'
      )}
    </p>
  )
}

type StoryReviewProps = {
  story: UserStory
  role: Role
  approving: boolean
  editing: boolean
  onApprove: () => void
}

// Approval for the story's current stage, shown in the page sidebar so it stays visible while reading.
export function StoryReview({ story, role, approving, editing, onApprove }: StoryReviewProps) {
  const stage = stageForColumn(story.column)
  const output = stage && story.stages[stage.id]
  if (!stage || !output) return null
  const canValidate = stage.approvers.includes(role)
  const review = output.review

  return (
    <div className="space-y-2">
      <ApproveStoryDialog
        storyKey={story.key}
        stageLabel={stage.label}
        isPlan={stage.id === 'plan'}
        disabled={!canValidate || editing}
        pending={approving}
        onApprove={onApprove}
        className="w-full"
      />
      <p className="text-xs text-muted-foreground">
        {editing ? (
          'Save or cancel your edits before approving.'
        ) : review?.decision === 'rejected' ? (
          <span className="text-amber-700 dark:text-amber-400">Changes requested by {review.by}: update the document or ask the agent.</span>
        ) : canValidate ? (
          `Validation by ${stage.approvers.join(' or ')}`
        ) : (
          `Only ${stage.approvers.join(' or ')} can validate this step.`
        )}
      </p>
    </div>
  )
}

// Human comments on a stage document, read from the story's journal.
// Commenting returns the document for revision, either manually or through the agent chat.
type CommentsProps = {
  story: UserStory
  stageId: StageId
  canComment: boolean
  onComment: (text: string) => void
}

function Comments({ story, stageId, canComment, onComment }: CommentsProps) {
  const { data: journal = [] } = useJournal(story.id)
  const comments = journal
    .filter((entry) => entry.usId === story.id && entry.stage === stageId && entry.detail)
    .filter((entry) => entry.action === 'refused' || entry.action === 'rejected')
    .sort((a, b) => a.at.localeCompare(b.at))

  if (!comments.length && !canComment) return null

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageSquareText className="size-3.5" aria-hidden="true" />
        Comments
        {comments.length > 0 && <span className="tabular-nums">{comments.length}</span>}
      </h3>
      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <UserAvatar name={comment.actor} className="size-7 text-[10px]" />
              <div className="min-w-0 flex-1 rounded-lg border px-3 py-2">
                <p className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium">{comment.actor}</span>
                  <time dateTime={comment.at} className="text-muted-foreground">
                    {timeAgo(comment.at)}
                  </time>
                </p>
                <p className="mt-1 whitespace-pre-line">{comment.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canComment && <CommentInput onSend={onComment} />}
    </section>
  )
}

function CommentInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('')

  function send() {
    const value = text.trim()
    if (!value) return
    onSend(value)
    setText('')
  }

  return (
    <form
      className="rounded-lg border focus-within:ring-2 focus-within:ring-ring/50"
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            send()
          }
        }}
        placeholder="Leave a comment: what should change in this document?"
        className="min-h-16 resize-none border-0 shadow-none focus-visible:ring-0"
        aria-label="Comment"
      />
      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        <p className="text-xs text-muted-foreground">Sends the document back for changes.</p>
        <Button type="submit" size="sm" variant="outline" disabled={!text.trim()}>
          Comment
        </Button>
      </div>
    </form>
  )
}

function ChatThread({ output }: { output: StageOutput }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">Discussion with the agent</h3>
      <ul className="space-y-2">
        {output.chat.map((message) => (
          <li
            key={message.id}
            className={cn(
              'max-w-[85%] rounded-lg px-3 py-2',
              message.author === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted',
            )}
          >
            <p className="mb-0.5 text-xs opacity-70">{message.author === 'user' ? message.role : 'Agent'}</p>
            {message.text}
          </li>
        ))}
      </ul>
    </section>
  )
}

type ChatInputProps = {
  inputRef: Ref<HTMLTextAreaElement>
  agent: string
  onSend: (text: string) => void
}

function ChatInput({ inputRef, agent, onSend }: ChatInputProps) {
  const [text, setText] = useState('')

  function send() {
    const value = text.trim()
    if (!value) return
    onSend(value)
    setText('')
  }

  return (
    <form
      className="flex items-end gap-2 rounded-3xl border bg-background p-2 pl-4 shadow-lg transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <Textarea
        ref={inputRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            send()
          }
        }}
        rows={1}
        placeholder={`Ask the ${agent} to change something…`}
        className="max-h-48 min-h-9 resize-none rounded-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
        aria-label={`Message to the ${agent}`}
      />
      <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={!text.trim()} aria-label="Send message">
        <ArrowUp />
      </Button>
    </form>
  )
}

function StoryDiff({ before, after }: { before: string; after: string }) {
  const lines = diffLines(before, after)

  return (
    <div className="overflow-hidden rounded-lg border font-mono text-xs">
      {lines.map((line, index) => (
        <div
          key={index}
          className={cn(
            'flex gap-2 px-3 py-0.5 whitespace-pre-wrap',
            line.type === 'added' && 'bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-200',
            line.type === 'removed' && 'bg-red-50 text-red-900 line-through decoration-red-400/60 dark:bg-red-950/40 dark:text-red-200',
          )}
        >
          <span className="w-3 shrink-0 select-none opacity-60" aria-hidden="true">
            {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ''}
          </span>
          <span className="min-w-0">{line.text || ' '}</span>
        </div>
      ))}
    </div>
  )
}
