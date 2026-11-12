import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Link, useSearchParams } from 'react-router'
import { ChevronRight, FileText, FolderOpen, MessagesSquare, SquarePen, SquareKanban } from 'lucide-react'
import { useProjects, useStories } from '@/api/hooks'
import { PageHeader } from '@/components/layout/page-header'
import { Markdown } from '@/components/markdown'
import AIConversation from '@/components/smoothui/ai-conversation'
import type { AIState } from '@/components/smoothui/ai-core'
import AIDiff from '@/components/smoothui/ai-diff'
import AIMessage from '@/components/smoothui/ai-message'
import AIOrbFace from '@/components/smoothui/ai-orb-face'
import AIPromptInput from '@/components/smoothui/ai-prompt-input'
import AIReasoning from '@/components/smoothui/ai-reasoning'
import AITaskList from '@/components/smoothui/ai-task-list'
import AILoader from '@/components/smoothui/ai-loader'
import { ChatThreadsNav } from '@/components/story-chat/chat-threads-nav'
import { DotGridBackground } from '@/components/story-chat/dot-grid-background'
import { StoryChatHome } from '@/components/story-chat/story-chat-home'
import { StoryDraftCard } from '@/components/story-chat/story-draft-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  buildDraftTurn,
  buildEditTurn,
  chatSuggestions,
  adoptExampleThreads,
  loadThreads,
  pendingDecision,
  relativeTime,
  saveThreads,
  simulateAgentReply,
  titleFromPrompt,
  type ChatThread,
  type AgentTurn,
  type ChatTurn,
} from '@/lib/story-chat'

const NEW_STORY = 'new'
const NAV_COLLAPSED_KEY = 'atlas.storyChat.navCollapsed'
let idSeq = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++idSeq}`

export function StoryChatPage() {
  const [params, setParams] = useSearchParams()
  const { data: projects = [] } = useProjects()
  const { data: stories = [] } = useStories()

  const [threads, setThreads] = useState<ChatThread[]>(loadThreads)
  useEffect(() => saveThreads(threads), [threads])
  // Example chats follow whatever projects the backend returns (fixtures or FastAPI).
  useEffect(() => setThreads((current) => adoptExampleThreads(current, projects, stories)), [projects, stories])
  const [navCollapsed, setNavCollapsed] = useState(() => localStorage.getItem(NAV_COLLAPSED_KEY) === 'true')

  // Each chat replies on its own: several agents can work in parallel.
  const stops = useRef(new Map<string, () => void>())
  useEffect(() => () => stops.current.forEach((stopReply) => stopReply()), [])

  const thread = threads.find((item) => item.id === params.get('chat'))
  const projectId = thread?.projectId ?? params.get('project') ?? projects[0]?.id ?? null
  const storyId = thread ? (thread.storyId ?? NEW_STORY) : (params.get('us') ?? NEW_STORY)
  const projectStories = stories.filter((item) => item.projectId === projectId)
  const story = projectStories.find((item) => item.id === storyId)
  const turns = thread?.turns ?? []

  const running = turns.find((turn): turn is AgentTurn => turn.from === 'agent' && turn.status !== 'done')
  const orbState: AIState = running ? (running.status === 'thinking' ? 'thinking' : 'streaming') : turns.length ? 'done' : 'idle'

  function navigate(changes: Record<string, string | null>) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key)
        else next.set(key, value)
      }
      return next
    }, { replace: true })
  }

  function patchThread(id: string, patch: (thread: ChatThread) => ChatThread) {
    setThreads((current) => current.map((item) => (item.id === id ? patch(item) : item)))
  }

  function updateTurn(threadId: string, next: AgentTurn) {
    patchThread(threadId, (item) => ({ ...item, updatedAt: Date.now(), turns: item.turns.map((turn) => (turn.id === next.id ? next : turn)) }))
  }

  function setProject(value: string | null) {
    // A chat belongs to one project: picking another one starts a fresh chat there.
    navigate({ chat: null, us: null, project: value })
  }

  function setStory(value: string | null) {
    const picked = projectStories.find((item) => item.id === value)
    if (thread) patchThread(thread.id, (item) => ({ ...item, storyId: picked?.id, storyKey: picked?.key }))
    else navigate({ us: picked?.id ?? null })
  }

  function send(text: string) {
    if (running || !projectId) return
    const agent = story ? buildEditTurn(nextId('turn'), text, story) : buildDraftTurn(nextId('turn'), text)
    const userTurn: ChatTurn = { id: nextId('turn'), from: 'user', text, storyKey: story?.key }
    let threadId = thread?.id
    if (threadId) {
      patchThread(threadId, (item) => ({ ...item, updatedAt: Date.now(), turns: [...item.turns, userTurn, agent] }))
    } else {
      threadId = nextId('chat')
      const created: ChatThread = {
        id: threadId,
        projectId,
        storyId: story?.id,
        storyKey: story?.key,
        title: titleFromPrompt(text),
        turns: [userTurn, agent],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setThreads((current) => [created, ...current])
      navigate({ chat: threadId, us: null, project: null })
    }
    const id = threadId
    stops.current.set(id, simulateAgentReply(agent, (next) => updateTurn(id, next)))
  }

  function stop() {
    if (!thread) return
    stops.current.get(thread.id)?.()
    if (running) updateTurn(thread.id, { ...running, status: 'done', tasks: running.tasks.map((t) => (t.status === 'done' ? t : { ...t, status: 'failed' })) })
  }

  function deleteThread(id: string) {
    stops.current.get(id)?.()
    stops.current.delete(id)
    setThreads((current) => current.filter((item) => item.id !== id))
    if (thread?.id === id) navigate({ chat: null })
  }

  const projectOptions = projects.map((project) => ({ value: project.id, label: project.name }))
  const storyOptions = [
    { value: NEW_STORY, label: 'Nouvelles US' },
    ...projectStories.map((item) => ({ value: item.id, label: `${item.key} · ${item.title}` })),
  ]

  // On the welcome screen the composer is a frosted panel over the dithered backdrop.
  const composer = (glass = false) => (
    <AIPromptInput
      className={glass ? 'border-foreground/15 bg-transparent' : undefined}
      aria-label="Message to the story agent"
      placeholder={story ? `Que veux-tu changer sur ${story.key} ?` : 'Décris le besoin, je rédige les user stories…'}
      state={orbState === 'done' ? 'idle' : orbState}
      disabled={!projectId}
      onSubmit={send}
      onStop={stop}
    >
      <Select items={projectOptions} value={projectId} onValueChange={setProject}>
        <SelectTrigger size="sm" className="max-w-44 border-0 bg-muted/60 shadow-none" aria-label="Project">
          <FolderOpen className="text-muted-foreground" aria-hidden="true" />
          <SelectValue placeholder="Projet" className="truncate" />
        </SelectTrigger>
        <SelectContent>
          {projectOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select items={storyOptions} value={storyId} onValueChange={setStory}>
        <SelectTrigger size="sm" className="max-w-56 border-0 bg-muted/60 shadow-none" aria-label="User story">
          {story ? <FileText className="text-muted-foreground" aria-hidden="true" /> : <SquarePen className="text-muted-foreground" aria-hidden="true" />}
          <SelectValue className="truncate" />
        </SelectTrigger>
        <SelectContent>
          {storyOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </AIPromptInput>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Story chat"
        icon={MessagesSquare}
        trail={
          <ChatBreadcrumb
            projectName={projects.find((p) => p.id === projectId)?.name}
            thread={thread}
            onRename={(title) => thread && patchThread(thread.id, (item) => ({ ...item, title }))}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
      <ChatThreadsNav
        threads={threads}
        projects={projects}
        activeId={thread?.id ?? null}
        collapsed={navCollapsed}
        onToggleCollapsed={() => setNavCollapsed((value) => {
          localStorage.setItem(NAV_COLLAPSED_KEY, String(!value))
          return !value
        })}
        onSelect={(id) => navigate({ chat: id, us: null, project: null })}
        onNewChat={(id) => navigate({ chat: null, us: null, project: id ?? projectId })}
        onRename={(id, title) => patchThread(id, (item) => ({ ...item, title }))}
        onDelete={deleteThread}
      />
      <div className="flex min-w-0 flex-1 flex-col">
      {turns.length === 0 ? (
        <div className="relative min-h-0 flex-1">
          <DotGridBackground />
          {/* The welcome screen never scrolls: content is centered and sized to fit the viewport. */}
          <div className="relative h-full overflow-hidden">
            <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center gap-8 px-6 py-6">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <AIOrbFace size={30} state="idle" />
                  <h2 className="text-2xl font-medium tracking-tight">Story chat</h2>
                </div>
                <div className="rounded-2xl bg-background/70 shadow-[0_12px_48px_-12px_rgb(0_0_0/0.6)] backdrop-blur-2xl backdrop-saturate-150">{composer(true)}</div>
                {/* One row, as wide as the composer. */}
                <div className="flex gap-2" aria-label="Suggestions">
                  {chatSuggestions.map((suggestion) => (
                    <Button
                      key={suggestion.id}
                      variant="ghost"
                      size="sm"
                      title={suggestion.label}
                      className="glass min-w-0 flex-1 justify-center rounded-full font-normal text-foreground/80 hover:bg-background/60 hover:text-foreground"
                      onClick={() => send(suggestion.label)}
                    >
                      <span className="truncate">{suggestion.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <StoryChatHome threads={threads} projects={projects} onSelect={(id) => navigate({ chat: id, us: null, project: null })} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <AIConversation className="flex-1" contentKey={JSON.stringify(turns.map((t) => (t.from === 'agent' ? t.status + t.tasks.map((x) => x.status).join() : t.id)))}>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
              {turns.map((turn) =>
                turn.from === 'user' ? (
                  <AIMessage key={turn.id} from="user" copyText={turn.text}>
                    {turn.storyKey && <Badge variant="secondary" className="mb-1.5">{turn.storyKey}</Badge>}
                    <p className="whitespace-pre-wrap">{turn.text}</p>
                  </AIMessage>
                ) : (
                  <AgentMessage key={turn.id} turn={turn} onChange={(next) => thread && updateTurn(thread.id, next)} />
                ),
              )}
            </div>
          </AIConversation>
          <div className="mx-auto w-full max-w-3xl px-4 pb-4">{composer()}</div>
        </>
      )}
      </div>
      </div>
    </div>
  )
}

// Header trail like T3 Code: › project › chat title (click to rename) › linked story and agent status.
function ChatBreadcrumb({ projectName, thread, onRename }: { projectName?: string; thread?: ChatThread; onRename: (title: string) => void }) {
  const [renaming, setRenaming] = useState(false)
  if (!projectName) return null
  const running = thread?.turns.some((turn) => turn.from === 'agent' && turn.status !== 'done')
  const pending = thread && pendingDecision(thread)
  const separator = <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
  return (
    <>
      {separator}
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <FolderOpen className="size-3.5" aria-hidden="true" />
        <span className="max-w-40 truncate">{projectName}</span>
      </span>
      {separator}
      {!thread ? (
        <span className="text-muted-foreground">Nouveau chat</span>
      ) : renaming ? (
        <Input
          autoFocus
          defaultValue={thread.title}
          aria-label="Nom du chat"
          className="h-7 w-64"
          onBlur={(event) => { onRename(event.target.value.trim() || thread.title); setRenaming(false) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setRenaming(false)
          }}
        />
      ) : (
        <button type="button" title="Renommer" onClick={() => setRenaming(true)} className="min-w-0 truncate rounded px-1 -mx-1 font-medium hover:bg-accent">
          {thread.title}
        </button>
      )}
      {thread && (
        <span className="ml-1 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {thread.storyKey && <Badge variant="secondary" className="font-mono">{thread.storyKey}</Badge>}
          {running ? (
            <span className="flex items-center gap-1.5"><AILoader variant="dots" label="L’agent travaille" className="scale-75" /> L’agent travaille</span>
          ) : pending ? (
            <Badge variant="outline" className="gap-1.5"><span className="size-1.5 rounded-full bg-amber-500" />À valider</Badge>
          ) : (
            <span>{relativeTime(thread.updatedAt)}</span>
          )}
        </span>
      )}
    </>
  )
}

function AgentMessage({ turn, onChange }: { turn: AgentTurn; onChange: (turn: AgentTurn) => void }) {
  const thinking = turn.status === 'thinking'
  const state: AIState = thinking ? 'thinking' : turn.status === 'streaming' ? 'streaming' : 'done'

  return (
    <AIMessage
      from="assistant"
      bubble={false}
      avatar={<AIOrbFace size={28} state={state} gaze={false} />}
    >
      <div className="flex flex-col gap-3">
        <AIReasoning isStreaming={thinking} duration={turn.thinkingSeconds} collapseWhenDone>
          {turn.reasoning}
        </AIReasoning>
        {thinking || turn.status === 'streaming' ? (
          <AITaskList label="Plan" tasks={turn.tasks} />
        ) : null}

        {!thinking && (
          <>
            <Markdown>{turn.intro}</Markdown>
            {turn.kind === 'drafts' ? <DraftsBlock turn={turn} onChange={onChange} /> : <EditBlock turn={turn} onChange={onChange} />}
          </>
        )}
      </div>
    </AIMessage>
  )
}

type DraftsTurn = Extract<AgentTurn, { kind: 'drafts' }>
type EditTurn = Extract<AgentTurn, { kind: 'edit' }>

function DraftsBlock({ turn, onChange }: { turn: DraftsTurn; onChange: (turn: AgentTurn) => void }) {
  const locked = Boolean(turn.decision)
  return (
    <>
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {turn.drafts.map((draft, index) => (
            <StoryDraftCard
              key={draft.id}
              draft={draft}
              index={index}
              locked={locked}
              onChange={(next) => onChange({ ...turn, drafts: turn.drafts.map((d) => (d.id === next.id ? next : d)) })}
              onRemove={() => onChange({ ...turn, drafts: turn.drafts.filter((d) => d.id !== draft.id) })}
            />
          ))}
        </AnimatePresence>
      </div>
      {turn.status === 'done' && turn.drafts.length > 0 && (
        <DraftsDecision
          drafts={turn.drafts}
          decision={turn.decision}
          onAcceptAll={() => onChange({ ...turn, drafts: turn.drafts.map((d) => (d.verdict ? d : { ...d, verdict: 'accepted' })) })}
          onDecide={(decision) => onChange({ ...turn, decision })}
        />
      )}
      {turn.decision === 'create' && (
        <Button size="sm" variant="outline" className="self-start" render={<Link to="/kanban" />}>
          <SquareKanban /> Voir sur le kanban
        </Button>
      )}
    </>
  )
}

function EditBlock({ turn, onChange }: { turn: EditTurn; onChange: (turn: AgentTurn) => void }) {
  return (
    <>
      <AIDiff
        title={`${turn.story.key} · description`}
        lines={turn.diff}
        onAccept={turn.decision ? undefined : () => onChange({ ...turn, decision: 'accepted' })}
        onReject={turn.decision ? undefined : () => onChange({ ...turn, decision: 'rejected' })}
      />
      {turn.decision && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {turn.decision === 'accepted' ? 'Modifications appliquées à' : 'Modifications rejetées pour'}{' '}
          <Link to={`/kanban/${turn.story.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">{turn.story.key}</Link>
        </p>
      )}
    </>
  )
}

const decisionLabels: Record<NonNullable<DraftsTurn['decision']>, string> = {
  create: 'Créées dans To author',
  refine: 'On continue à affiner',
  discard: 'Propositions abandonnées',
}

// Human checkpoint before the drafts reach the board; once decided, it shrinks to a one-line receipt.
// Only the stories accepted one by one are created; undecided ones block the button.
function DraftsDecision({ drafts, decision, onAcceptAll, onDecide }: {
  drafts: DraftsTurn['drafts']
  decision?: DraftsTurn['decision']
  onAcceptAll: () => void
  onDecide: (decision: NonNullable<DraftsTurn['decision']>) => void
}) {
  const accepted = drafts.filter((draft) => draft.verdict === 'accepted').length
  const rejected = drafts.filter((draft) => draft.verdict === 'rejected').length
  const undecided = drafts.length - accepted - rejected
  const plural = (n: number) => `${n} user ${n > 1 ? 'stories' : 'story'}`
  if (decision) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={decision === 'discard' ? 'outline' : 'secondary'}>{decisionLabels[decision]}</Badge>
        {decision === 'create' && plural(accepted || drafts.length)}
      </p>
    )
  }
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{accepted ? `Créer ${plural(accepted)} sur le kanban ?` : 'Accepte les stories à créer'}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" />{accepted} acceptée{accepted > 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-muted-foreground/50" />{rejected} rejetée{rejected > 1 ? 's' : ''}</span>
          {undecided > 0 && <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-amber-500" />{undecided} à trancher</span>}
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex flex-wrap gap-2">
        <Button size="sm" disabled={accepted === 0 || undecided > 0} onClick={() => onDecide('create')}>Créer dans To author</Button>
        {undecided > 0 && <Button size="sm" variant="outline" onClick={onAcceptAll}>Tout accepter</Button>}
        <Button size="sm" variant="outline" onClick={() => onDecide('refine')}>Continuer à affiner</Button>
        <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => onDecide('discard')}>Tout abandonner</Button>
      </CardFooter>
    </Card>
  )
}
