import { useCallback, useEffect, useRef, useState } from 'react'
import { useStickToBottom } from 'use-stick-to-bottom'
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
import { useAppDispatch } from '@/lib/store'
import { cn, scrollParent } from '@/lib/utils'

type ToolPart = Extract<OpencodePart, { type: 'tool' }>

// Messages of one step: from its first message to the start of the next step.
function splitBySteps(messages: OpencodeMessage[], starts: UserStory['opencode']) {
  const bySteps = new Map<OpencodeStepId, OpencodeMessage[]>()
  let step: OpencodeStepId = 'plan'
  for (const message of messages) {
    const started = opencodeSteps.find((item) => starts?.steps[item.id] === message.info.id)
    if (started) step = started.id
    bySteps.set(step, [...(bySteps.get(step) ?? []), message])
  }
  return bySteps
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
// Messages flow in the page scroller, which keeps following new content while the user is at the bottom.
export function OpencodeSession({ story, step, isCurrent, emptyText }: OpencodeSessionProps) {
  const { data: messages = [], isLoading, busy } = useOpencodeMessages(story.id, Boolean(story.opencode))
  const { send, abort } = useOpencodeMutations()
  const [showEarlier, setShowEarlier] = useState(false)
  const dispatch = useAppDispatch()
  const wasBusy = useRef(busy)
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({ initial: 'instant', resize: 'smooth' })
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef(node && scrollParent(node))
      contentRef(node)
    },
    [scrollRef, contentRef],
  )

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

  return (
    <>
      <div ref={attach} className="flex flex-col gap-6 pb-8">
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
            <StepMessages key={item.id} label={item.label} messages={bySteps.get(item.id) ?? []} />
          ))}

        {isLoading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader className="size-4 animate-spin" aria-hidden="true" />
            Loading the OpenCode session…
          </p>
        ) : current.length ? (
          <StepMessages label={earlier.length && showEarlier ? opencodeSteps[stepIndex].label : undefined} messages={current} />
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
        {!isAtBottom && (
          <Button
            variant="outline"
            size="icon"
            className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-background shadow-md"
            onClick={() => void scrollToBottom()}
            aria-label="Scroll to the latest message"
          >
            <ArrowDown />
          </Button>
        )}
        <PromptInput
          label="Message to OpenCode"
          placeholder={isCurrent ? `Message OpenCode (${agent} agent)…` : 'This step is over: the session continues in the current step.'}
          disabled={!isCurrent || !story.opencode}
          busy={stepBusy}
          onSubmit={(text) => {
            void send.trigger({ id: story.id, text })
            void scrollToBottom()
          }}
          onStop={() => void abort.trigger(story.id)}
        />
      </div>
    </>
  )
}

function StepMessages({ label, messages }: { label?: string; messages: OpencodeMessage[] }) {
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
        message.info.role === 'user' ? <UserMessage key={message.info.id} message={message} /> : <AssistantMessage key={message.info.id} message={message} />,
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
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
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

function AssistantMessage({ message }: { message: OpencodeMessage }) {
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
        {parts.map((part) => (
          <Part key={part.id} part={part} live={!info.time.completed} />
        ))}
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

function Part({ part, live }: { part: OpencodePart; live: boolean }) {
  switch (part.type) {
    case 'text':
      return part.synthetic ? null : <Markdown className={chatMarkdown}>{part.text}</Markdown>
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

  if (part.tool === 'todowrite' && Array.isArray(input.todos)) {
    return (
      <ul className="space-y-1">
        {(input.todos as { id: string; content: string; status: string }[]).map((todo) => (
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
