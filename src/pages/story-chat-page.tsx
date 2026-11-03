import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Link, useSearchParams } from 'react-router'
import { FileText, FolderOpen, MessagesSquare, SquarePen, SquareKanban } from 'lucide-react'
import { useProjects, useStories } from '@/api/hooks'
import { PageHeader } from '@/components/layout/page-header'
import { Markdown } from '@/components/markdown'
import AIApproval from '@/components/smoothui/ai-approval'
import AIConversation from '@/components/smoothui/ai-conversation'
import type { AIState } from '@/components/smoothui/ai-core'
import AIDiff from '@/components/smoothui/ai-diff'
import AIMessage from '@/components/smoothui/ai-message'
import AIOrbFace from '@/components/smoothui/ai-orb-face'
import AIPromptInput from '@/components/smoothui/ai-prompt-input'
import AIReasoning from '@/components/smoothui/ai-reasoning'
import AISuggestions from '@/components/smoothui/ai-suggestions'
import AITaskList from '@/components/smoothui/ai-task-list'
import { ChatThreadsNav } from '@/components/story-chat/chat-threads-nav'
import { StoryDraftCard } from '@/components/story-chat/story-draft-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  buildDraftTurn,
  buildEditTurn,
  chatSuggestions,
  loadThreads,
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

  const composer = (
    <AIPromptInput
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
        detail={thread ? { text: thread.title, visible: true } : undefined}
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
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
          <AIOrbFace size={112} state="idle" />
          <div className="space-y-1.5 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Qu’est-ce qu’on écrit aujourd’hui ?</h2>
            <p className="text-sm text-muted-foreground">
              Décris un besoin pour générer plusieurs user stories, ou choisis une US pour la modifier directement.
            </p>
          </div>
          <div className="w-full max-w-2xl space-y-4">
            {composer}
            <AISuggestions suggestions={chatSuggestions} onSelect={(suggestion) => send(suggestion.label)} />
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
          <div className="mx-auto w-full max-w-3xl px-4 pb-4">{composer}</div>
        </>
      )}
      </div>
      </div>
    </div>
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
        <AIApproval
          question={`Créer ${turn.drafts.length} user ${turn.drafts.length > 1 ? 'stories' : 'story'} sur le kanban ?`}
          resolvedId={turn.decision}
          onDecide={(option) => onChange({ ...turn, decision: option.id as DraftsTurn['decision'] })}
          options={[
            { id: 'create', label: 'Créer dans To author', detail: 'Les US partent chez l’agent d’authoring' },
            { id: 'refine', label: 'Continuer à affiner', detail: 'Réponds dans le chat pour ajuster' },
            { id: 'discard', label: 'Tout abandonner', destructive: true },
          ]}
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
