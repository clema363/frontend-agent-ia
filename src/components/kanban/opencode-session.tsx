import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  Brain,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  FileCode,
  FilePen,
  FileSearch,
  FileText,
  FolderTree,
  Globe,
  ListTodo,
  Loader,
  Search,
  SquareTerminal,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { opencodeIsBusy, useOpencodeMessages, useOpencodeMutations } from '@/api/hooks'
import { atlasApi } from '@/api/rtk-api'
import { PromptInput } from '@/components/ai/prompt-input'
import { AgentAvatar } from '@/components/kanban/coding-agent'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { opencodeSteps, type OpencodeMessage, type OpencodePart, type OpencodeStepId, type UserStory } from '@/lib/domain'
import { changedFiles, latestTodos, planAnchor, planVersions, splitBySteps, splitPlan, type Todo, type ToolPart } from '@/lib/opencode'
import { useAppDispatch } from '@/lib/store'
import { useFollowBottom } from '@/hooks/use-follow-bottom'
import { cn } from '@/lib/utils'

// Version shown on an answer that contains a plan.
type PlanBadge = { version: number; status: 'pending' | 'approved' | 'replaced'; latest: number }

const planStatusLabels: Record<PlanBadge['status'], string> = {
  pending: 'Up for approval',
  approved: 'Approved',
  replaced: 'Replaced',
}

type OpencodeSessionProps = {
  story: UserStory
  step: OpencodeStepId
  // Only the story's current step accepts messages: the session continues from there.
  isCurrent: boolean
  // Shown when the step has no message yet.
  emptyText: string
}

// The OpenCode session of a story, as a chat: prompts sent, answers, reasoning and tool calls.
// Messages flow in the page scroller, which opens at the latest message and follows the stream.
export function OpencodeSession({ story, step, isCurrent, emptyText }: OpencodeSessionProps) {
  const { data: messages = [], isLoading, busy } = useOpencodeMessages(story.id, Boolean(story.opencode))
  const { send, abort } = useOpencodeMutations()
  const [showEarlier, setShowEarlier] = useState(false)
  const dispatch = useAppDispatch()
  const wasBusy = useRef(busy)
  const { contentRef, atBottom, scrollToBottom } = useFollowBottom(!isLoading)

  // An answer that ends can move the story (plan ready, merge request opened).
  useEffect(() => {
    if (wasBusy.current && !busy) dispatch(atlasApi.util.invalidateTags(['Stories']))
    wasBusy.current = busy
  }, [busy, dispatch])

  const bySteps = splitBySteps(messages, story.opencode)
  const stepIndex = opencodeSteps.findIndex((item) => item.id === step)
  const earlier = opencodeSteps.slice(0, stepIndex).filter((item) => bySteps.get(item.id)?.length)
  const current = bySteps.get(step) ?? []
  const stepBusy = isCurrent && busy
  const agent = opencodeSteps[stepIndex].agent

  const versions = planVersions(messages, story.opencode)
  const latestPlan = versions.at(-1)
  const planApproved = story.stages.plan?.review?.decision === 'approved'
  const badges = new Map<string, PlanBadge>(
    versions.map(({ messageId, version }) => [
      messageId,
      { version, latest: versions.length, status: version < versions.length ? 'replaced' : planApproved ? 'approved' : 'pending' },
    ]),
  )

  return (
    <>
      <div ref={contentRef} className="flex flex-1 flex-col gap-6 pb-8">
        {earlier.length > 0 && (
          <button
            type="button"
            onClick={() => setShowEarlier((value) => !value)}
            className="flex items-center gap-2 self-center rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronRight className={cn('size-3.5 transition-transform', showEarlier && 'rotate-90')} aria-hidden="true" />
            {showEarlier ? 'Hide' : 'Show'} {earlier.map((item) => `${item.label} (${bySteps.get(item.id)?.length})`).join(' · ')}
          </button>
        )}
        {showEarlier &&
          earlier.map((item) => (
            <StepMessages key={item.id} label={item.label} messages={bySteps.get(item.id) ?? []} badges={badges} />
          ))}

        {isLoading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader className="size-4 animate-spin" aria-hidden="true" />
            Loading the OpenCode session…
          </p>
        ) : current.length ? (
          <StepMessages label={earlier.length && showEarlier ? opencodeSteps[stepIndex].label : undefined} messages={current} badges={badges} />
        ) : (
          <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
            <CircleDashed className="size-4" aria-hidden="true" />
            {emptyText}
          </p>
        )}
        {stepBusy && <Thinking messages={current} />}
      </div>

      {/* Pinned to the bottom of the page scroller, like the stage chat composer. */}
      <div className="sticky -bottom-10 z-10 -mb-10 bg-linear-to-t from-background from-75% to-transparent pt-6 pb-3">
        {!atBottom && (
          <Button
            variant="outline"
            size="icon"
            className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-full bg-background shadow-md"
            onClick={() => scrollToBottom()}
            aria-label="Scroll to the latest message"
          >
            <ArrowDown />
          </Button>
        )}
        {step === 'plan' && latestPlan && (
          <button
            type="button"
            onClick={() => document.getElementById(planAnchor(latestPlan.messageId))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="mb-2 ml-3 flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs shadow-sm transition-colors hover:bg-muted"
          >
            <FileText className="size-3.5 text-primary" aria-hidden="true" />
            <span className="font-medium">Plan v{latestPlan.version}</span>
            <span className="text-muted-foreground">· {planApproved ? 'approved' : 'up for approval'} · View</span>
          </button>
        )}
        <PromptInput
          label="Message to OpenCode"
          placeholder={isCurrent ? `Message OpenCode (${agent} agent)…` : 'This step is over: the session continues in the current step.'}
          disabled={!isCurrent || !story.opencode}
          busy={stepBusy}
          onSubmit={(text) => {
            void send.trigger({ id: story.id, text })
            scrollToBottom()
          }}
          onStop={() => void abort.trigger(story.id)}
        />
      </div>
    </>
  )
}

function StepMessages({ label, messages, badges }: { label?: string; messages: OpencodeMessage[]; badges: Map<string, PlanBadge> }) {
  return (
    <>
      {label && (
        <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground" role="separator">
          <span className="h-px flex-1 bg-border" />
          {label}
          <span className="h-px flex-1 bg-border" />
        </div>
      )}
      {messages.map((message) =>
        message.info.role === 'user' ? <UserMessage key={message.info.id} message={message} /> : <AssistantMessage key={message.info.id} message={message} plan={badges.get(message.info.id)} />,
      )}
    </>
  )
}

// Shown until the open answer has visible content.
function Thinking({ messages }: { messages: OpencodeMessage[] }) {
  const last = messages.at(-1)
  const started = last?.info.role === 'assistant' && last.parts.some((part) => part.type === 'text' || part.type === 'tool' || part.type === 'reasoning')
  if (started || !opencodeIsBusy(messages)) return null
  return (
    // Same line as an answer header, so the answer takes its place without a jump.
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <AgentAvatar />
      <span className="animate-pulse">OpenCode is thinking…</span>
    </p>
  )
}

const chatMarkdown = '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0'

function UserMessage({ message }: { message: OpencodeMessage }) {
  const text = message.parts.flatMap((part) => (part.type === 'text' && !part.synthetic ? [part.text] : [])).join('\n\n')
  return (
    <div className="ml-auto max-w-[85%] rounded-3xl bg-muted px-4 py-2.5">
      <Markdown className={chatMarkdown}>{text}</Markdown>
    </div>
  )
}

const numberFormat = new Intl.NumberFormat('en', { notation: 'compact' })

// Consecutive tool calls collapse into one summary line; step markers are invisible.
type Block = { kind: 'part'; part: OpencodePart } | { kind: 'tools'; parts: ToolPart[] }

function toBlocks(parts: OpencodePart[]): Block[] {
  const blocks: Block[] = []
  for (const part of parts) {
    if (part.type === 'step-start' || part.type === 'step-finish') continue
    const last = blocks.at(-1)
    if (part.type === 'tool' && last?.kind === 'tools') last.parts.push(part)
    else if (part.type === 'tool') blocks.push({ kind: 'tools', parts: [part] })
    else blocks.push({ kind: 'part', part })
  }
  return blocks
}

function AssistantMessage({ message, plan }: { message: OpencodeMessage; plan?: PlanBadge }) {
  const { info, parts } = message
  const tokens = info.tokens && info.tokens.input + info.tokens.output

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <AgentAvatar />
        <span className="font-medium text-foreground">OpenCode</span>
        {info.agent && <span className="rounded-full border px-1.5 py-px">{info.agent}</span>}
        {info.modelID && <span>{info.modelID}</span>}
      </p>
      <div className="space-y-3 pl-7">
        {toBlocks(parts).map((block) =>
          block.kind === 'part' ? (
            <Part key={block.part.id} part={block.part} live={!info.time.completed} plan={plan} />
          ) : (
            // Always a summary line, even for one call, so the layout doesn't switch when the next one arrives.
            <ToolGroup key={block.parts[0].id} parts={block.parts} />
          ),
        )}
        {info.error && (
          <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <CircleAlert className="size-4" aria-hidden="true" />
            {info.error.name === 'MessageAbortedError' ? 'Stopped.' : (info.error.data?.message ?? info.error.name)}
          </p>
        )}
        {info.time.completed && !info.error && tokens ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {numberFormat.format(tokens)} tokens
            {info.cost ? ` · $${info.cost.toFixed(2)}` : ''}
            {` · ${Math.max(1, Math.round((info.time.completed - info.time.created) / 1000))} s`}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Part({ part, live, plan }: { part: OpencodePart; live: boolean; plan?: PlanBadge }) {
  switch (part.type) {
    case 'text':
      return part.synthetic ? null : <TextPart text={part.text} live={live} plan={plan} messageId={part.messageID} />
    case 'reasoning':
      return <Reasoning text={part.text} seconds={part.time.end ? Math.max(1, Math.round((part.time.end - part.time.start) / 1000)) : undefined} live={live && !part.time.end} />
    case 'tool':
      return <ToolCall part={part} />
    case 'patch':
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <FilePen className="size-3.5" aria-hidden="true" />
          Changed {part.files.length} {part.files.length > 1 ? 'files' : 'file'}
          {part.files.map((file) => (
            <code key={file} className="rounded bg-muted px-1.5 py-px font-mono">{file}</code>
          ))}
          <span className="font-mono">{part.hash.slice(0, 7)}</span>
        </p>
      )
    case 'file':
      return (
        <a href={part.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
          <FileCode className="size-3.5" aria-hidden="true" />
          {part.filename ?? part.mime}
        </a>
      )
    default:
      return null
  }
}

// Reveals streamed text at a steady pace instead of in polling-sized chunks, a word at a time.
// Text that was already complete when it first rendered shows at once.
function useSmoothText(text: string, live: boolean) {
  const [shown, setShown] = useState(live ? 0 : text.length)
  useEffect(() => {
    if (shown >= text.length) return
    const frame = requestAnimationFrame(() =>
      // Catch up faster when far behind: about a third of a second per chunk.
      setShown((count) => Math.min(text.length, count + Math.max(2, Math.ceil((text.length - count) / 20)))),
    )
    return () => cancelAnimationFrame(frame)
  }, [shown, text])
  if (shown >= text.length) return text
  const cut = text.lastIndexOf(' ', shown)
  return text.slice(0, cut > 0 ? cut : shown)
}

function TextPart({ text, live, plan, messageId }: { text: string; live: boolean; plan?: PlanBadge; messageId: string }) {
  const visible = useSmoothText(text, live)
  // A plan being written already gets its card, so nothing reflows when the answer completes.
  if (plan || (live && splitPlan(visible).plan)) return <PlanText text={visible} plan={plan} messageId={messageId} />
  return <Markdown className={chatMarkdown}>{visible}</Markdown>
}

// A plan answer: OpenCode's comment, then the plan itself as a document card.
function PlanText({ text, plan, messageId }: { text: string; plan?: PlanBadge; messageId: string }) {
  const { intro, plan: document } = splitPlan(text)
  const replaced = plan?.status === 'replaced'

  return (
    <>
      {intro && <Markdown className={chatMarkdown}>{intro}</Markdown>}
      {document && (
        <section
          id={planAnchor(messageId)}
          aria-label={plan ? `Plan version ${plan.version}` : 'Plan being written'}
          className={cn('scroll-mt-28 rounded-xl border bg-card p-4 shadow-xs', !replaced && 'border-primary/40 ring-1 ring-primary/15')}
        >
          <p className="mb-3 flex items-center gap-2 text-xs">
            <FileText className={cn('size-3.5', replaced ? 'text-muted-foreground' : 'text-primary')} aria-hidden="true" />
            <span className="font-medium">{plan ? `Plan v${plan.version}` : 'Plan'}</span>
            <span
              className={cn(
                'rounded-full border px-1.5 py-px',
                (!plan || plan.status === 'pending') && 'border-primary/30 bg-primary/10 text-primary',
                plan?.status === 'approved' && 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
                replaced && 'text-muted-foreground',
                !plan && 'animate-pulse',
              )}
            >
              {!plan ? 'Writing…' : replaced ? `Replaced by v${plan.latest}` : planStatusLabels[plan.status]}
            </span>
          </p>
          {replaced ? (
            <Collapsible>
              <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronRight className="size-3.5 transition-transform group-data-[panel-open]:rotate-90" aria-hidden="true" />
                Show this version
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Markdown className={cn(chatMarkdown, 'pt-3 text-muted-foreground')}>{document}</Markdown>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <Markdown className={chatMarkdown}>{document}</Markdown>
          )}
        </section>
      )}
    </>
  )
}

function Reasoning({ text, seconds, live }: { text: string; seconds?: number; live: boolean }) {
  return (
    <Collapsible defaultOpen={live}>
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Brain className="size-3.5" aria-hidden="true" />
        <span className={cn(live && 'animate-pulse')}>{live ? 'Thinking…' : `Thought for ${seconds ?? 1} s`}</span>
        <ChevronRight className="size-3.5 transition-transform group-data-[panel-open]:rotate-90" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-2 border-l-2 pl-3 text-sm whitespace-pre-line text-muted-foreground italic">{text}</p>
      </CollapsibleContent>
    </Collapsible>
  )
}

// OpenCode built-in tools; MCP tools fall back to the wrench.
const tools: Record<string, { label: string; icon: LucideIcon }> = {
  read: { label: 'Read', icon: FileSearch },
  edit: { label: 'Edit', icon: FilePen },
  write: { label: 'Write', icon: FilePen },
  bash: { label: 'Shell', icon: SquareTerminal },
  grep: { label: 'Grep', icon: Search },
  glob: { label: 'Glob', icon: Search },
  list: { label: 'List', icon: FolderTree },
  webfetch: { label: 'Fetch', icon: Globe },
  todowrite: { label: 'Todos', icon: ListTodo },
  todoread: { label: 'Todos', icon: ListTodo },
  task: { label: 'Subagent', icon: Wrench },
}

// What a run of tool calls did, e.g. "Read 2 files · 1 search · ran 1 command".
function summarize(parts: ToolPart[]) {
  const count = (names: string[]) => parts.filter((part) => names.includes(part.tool)).length
  const plural = (n: number, one: string, many: string) => (n ? [`${n} ${n > 1 ? many : one}`] : [])
  const known = ['read', 'grep', 'glob', 'list', 'edit', 'write', 'bash', 'todowrite', 'todoread']
  const items = [
    ...plural(count(['read']), 'file read', 'files read'),
    ...plural(count(['grep', 'glob', 'list']), 'search', 'searches'),
    ...plural(count(['edit', 'write']), 'file edited', 'files edited'),
    ...plural(count(['bash']), 'command', 'commands'),
    ...(count(['todowrite', 'todoread']) ? ['todos updated'] : []),
    ...plural(parts.filter((part) => !known.includes(part.tool)).length, 'other tool', 'other tools'),
  ]
  return items.join(' · ')
}

function ToolGroup({ parts }: { parts: ToolPart[] }) {
  const running = parts.find((part) => part.state.status === 'pending' || part.state.status === 'running')
  const failed = parts.some((part) => part.state.status === 'error')

  return (
    <Collapsible className="text-sm">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-muted-foreground hover:text-foreground">
        {running ? (
          <Loader className="size-4 shrink-0 animate-spin text-primary" aria-label="Running" />
        ) : (
          <Wrench className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 truncate">
          {running ? `${(tools[running.tool] ?? { label: running.tool }).label} ${running.state.title ?? ''}…` : summarize(parts)}
        </span>
        {failed && <CircleAlert className="size-3.5 shrink-0 text-red-600 dark:text-red-400" aria-label="A tool failed" />}
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-data-[panel-open]:rotate-90" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 border-l-2 pl-3">
          {parts.map((part) => (
            <ToolCall key={part.id} part={part} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ToolCall({ part }: { part: ToolPart }) {
  const { state } = part
  const { label, icon: Icon } = tools[part.tool] ?? { label: part.tool, icon: Wrench }
  const running = state.status === 'pending' || state.status === 'running'
  const title = state.title ?? (typeof state.input.filePath === 'string' ? state.input.filePath : undefined)

  return (
    <Collapsible className="overflow-hidden rounded-lg border text-sm">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">{label}</span>
        {title && <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{title}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {running ? (
            <Loader className="size-3.5 animate-spin text-primary" aria-label="Running" />
          ) : state.status === 'error' ? (
            <CircleAlert className="size-3.5 text-red-600 dark:text-red-400" aria-label="Failed" />
          ) : (
            <CircleCheck className="size-3.5 text-green-600 dark:text-green-400" aria-label="Done" />
          )}
          <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90" aria-hidden="true" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 border-t bg-muted/30 p-3">
          <ToolDetails part={part} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

const pre = 'max-h-72 overflow-auto rounded-md bg-background p-2.5 font-mono text-xs whitespace-pre-wrap'

function ToolDetails({ part }: { part: ToolPart }) {
  const { state } = part
  const input = state.input
  const diff = typeof state.metadata?.diff === 'string' ? state.metadata.diff : undefined

  if (part.tool === 'todowrite' && Array.isArray(input.todos)) return <TodoList todos={input.todos as Todo[]} />

  return (
    <>
      {part.tool === 'bash' && typeof input.command === 'string' ? (
        <pre className={pre}>$ {input.command}</pre>
      ) : !diff && Object.keys(input).length > 0 ? (
        <pre className={pre}>{JSON.stringify(input, null, 2)}</pre>
      ) : null}
      {diff && <Diff diff={diff} />}
      {state.status === 'error' && state.error && <pre className={cn(pre, 'text-red-600 dark:text-red-400')}>{state.error}</pre>}
      {state.output && <pre className={pre}>{state.output}</pre>}
    </>
  )
}

function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul className="space-y-1">
      {todos.map((todo) => (
        <li key={todo.id} className={cn('flex items-center gap-2', todo.status === 'completed' && 'text-muted-foreground line-through')}>
          {todo.status === 'completed' ? (
            <CircleCheck className="size-3.5 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
          ) : todo.status === 'in_progress' ? (
            <Loader className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <CircleDashed className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          {todo.content}
        </li>
      ))}
    </ul>
  )
}

function Diff({ diff }: { diff: string }) {
  const lines = diff.split('\n').filter((line) => line && !/^(Index:|===|---|\+\+\+)/.test(line))
  return (
    <div className="max-h-72 overflow-auto rounded-md bg-background py-1 font-mono text-xs">
      {lines.map((line, index) => (
        <div
          key={index}
          className={cn(
            'px-2.5 whitespace-pre-wrap',
            line.startsWith('+') && 'bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-200',
            line.startsWith('-') && 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200',
            line.startsWith('@@') && 'text-muted-foreground',
          )}
        >
          {line}
        </div>
      ))}
    </div>
  )
}

// Coding progress for the story sidebar: OpenCode's latest todo list and the files it changed.
export function CodingProgress({ story }: { story: UserStory }) {
  const { data: messages = [] } = useOpencodeMessages(story.id, Boolean(story.opencode?.steps.coding))
  const coding = splitBySteps(messages, story.opencode).get('coding') ?? []
  const todos = latestTodos(coding)
  const files = changedFiles(coding)
  if (!story.opencode?.steps.coding || (!todos.length && !files.length)) return null
  const done = todos.filter((todo) => todo.status === 'completed').length

  return (
    <div className="space-y-4 text-sm">
      {todos.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tasks</span>
            <span className="tabular-nums">
              {done}/{todos.length}
            </span>
          </p>
          <TodoList todos={todos} />
        </div>
      )}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Changed files · {files.length}</p>
          <ul className="space-y-1">
            {files.map((file) => (
              <li key={file} className="flex items-center gap-1.5 font-mono text-xs" title={file}>
                <FilePen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{file}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
