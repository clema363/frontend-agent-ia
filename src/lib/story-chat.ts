import type { AIDiffLine } from '@/components/smoothui/ai-diff'
import type { AITask } from '@/components/smoothui/ai-task-list'
import type { IssueType, Priority, UserStory } from '@/lib/domain'

// UI-only model of the story chat. The backend agent is not wired yet:
// `simulateAgentReply` fakes its answer so the page can be designed and reviewed.

export type StoryDraft = {
  id: string
  type: IssueType
  priority: Priority
  title: string
  asA: string
  iWant: string
  soThat: string
  criteria: string[]
}

export type DraftDecision = 'create' | 'refine' | 'discard'
export type EditDecision = 'accepted' | 'rejected'

type AgentTurnBase = {
  id: string
  from: 'agent'
  status: 'thinking' | 'streaming' | 'done'
  reasoning: string
  thinkingSeconds?: number
  tasks: AITask[]
  intro: string
}

export type AgentTurn =
  | (AgentTurnBase & { kind: 'drafts'; drafts: StoryDraft[]; decision?: DraftDecision })
  | (AgentTurnBase & { kind: 'edit'; story: Pick<UserStory, 'id' | 'key' | 'title'>; diff: AIDiffLine[]; decision?: EditDecision })

export type UserTurn = {
  id: string
  from: 'user'
  text: string
  storyKey?: string
}

export type ChatTurn = UserTurn | AgentTurn

export const chatSuggestions = [
  { id: 'auth', label: 'Écris 3 US pour la connexion SSO' },
  { id: 'export', label: 'Découpe "export PDF des factures" en US' },
  { id: 'notif', label: 'US pour les notifications par email' },
  { id: 'edit', label: 'Ajoute des critères d’acceptation à l’US' },
]

const personas = ['utilisateur', 'administrateur', 'chef de projet']
const priorities: Priority[] = ['High', 'Medium', 'Medium', 'Low']

function countFromPrompt(text: string) {
  const match = text.match(/\b([1-9])\b/)
  return match ? Math.min(Number(match[1]), 6) : 3
}

function topicFromPrompt(text: string) {
  const quoted = text.match(/["“«](.+?)["”»]/)
  if (quoted) return quoted[1]
  const after = text.match(/(?:pour|sur|de)\s+(?:la |le |les |l’|l')?(.+)$/i)
  return (after?.[1] ?? text).replace(/[.?!]+$/, '').slice(0, 60)
}

export function buildDraftTurn(id: string, prompt: string): AgentTurn {
  const topic = topicFromPrompt(prompt)
  const steps = ['Configurer', 'Consulter', 'Modifier', 'Notifier', 'Historiser', 'Exporter']
  const drafts: StoryDraft[] = Array.from({ length: countFromPrompt(prompt) }, (_, index) => ({
    id: `${id}-d${index}`,
    type: index === 0 ? 'Story' : index === 3 ? 'Task' : 'Story',
    priority: priorities[index % priorities.length],
    title: `${steps[index % steps.length]} — ${topic}`,
    asA: personas[index % personas.length],
    iWant: `${steps[index % steps.length].toLowerCase()} ${topic}`,
    soThat: 'gagner du temps et éviter les erreurs de saisie',
    criteria: [
      `Étant donné un ${personas[index % personas.length]} connecté, quand il ouvre l’écran, alors il voit ${topic}`,
      'Les erreurs de validation sont affichées sous le champ concerné',
      'L’action est tracée dans le journal',
    ],
  }))
  return {
    id,
    from: 'agent',
    kind: 'drafts',
    status: 'thinking',
    reasoning: `Le besoin porte sur « ${topic} ». Je cherche les US existantes du projet pour éviter les doublons, puis je découpe en ${drafts.length} stories indépendantes (INVEST) avec des critères Given/When/Then.`,
    tasks: [
      { id: 'context', label: 'Lire le contexte du projet', status: 'pending' },
      { id: 'dupes', label: 'Chercher des US similaires', status: 'pending' },
      { id: 'split', label: `Découper en ${drafts.length} user stories`, status: 'pending' },
      { id: 'criteria', label: 'Rédiger les critères d’acceptation', status: 'pending' },
    ],
    intro: `Voici ${drafts.length} propositions. Tu peux les modifier, en retirer, puis les envoyer dans la colonne **To author** du kanban.`,
    drafts,
  }
}

export function buildEditTurn(id: string, prompt: string, story: UserStory): AgentTurn {
  const before = story.raw.split('\n').filter(Boolean).slice(0, 4)
  const diff: AIDiffLine[] = [
    ...before.map((content, index) => ({ kind: 'context' as const, content, number: index + 1 })),
    { kind: 'removed', content: 'Critères d’acceptation : à définir' },
    { kind: 'added', content: 'Critères d’acceptation :' },
    { kind: 'added', content: '- Étant donné un utilisateur connecté, quand il valide, alors la donnée est enregistrée' },
    { kind: 'added', content: '- Un message d’erreur explicite s’affiche si un champ est invalide' },
    { kind: 'added', content: `- ${prompt.replace(/[.?!]+$/, '')}` },
  ]
  return {
    id,
    from: 'agent',
    kind: 'edit',
    status: 'thinking',
    reasoning: `Tu veux modifier ${story.key}. Je relis la description actuelle et je propose uniquement les lignes à changer, sans toucher au reste.`,
    tasks: [
      { id: 'read', label: `Lire ${story.key}`, status: 'pending' },
      { id: 'diff', label: 'Préparer les modifications', status: 'pending' },
    ],
    intro: `Voici les changements proposés pour **${story.key} · ${story.title}**.`,
    story: { id: story.id, key: story.key, title: story.title },
    diff,
  }
}

// Plays the turn forward: tasks run one after the other, then the answer streams in.
export function simulateAgentReply(turn: AgentTurn, update: (next: AgentTurn) => void) {
  const timers: ReturnType<typeof setTimeout>[] = []
  const started = Date.now()
  let current = turn
  const push = (next: AgentTurn) => {
    current = next
    update(next)
  }
  turn.tasks.forEach((_task, index) => {
    timers.push(setTimeout(() => {
      push({
        ...current,
        tasks: current.tasks.map((item, i) => ({ ...item, status: i < index ? 'done' : i === index ? 'running' : 'pending' })),
      })
    }, 500 + index * 700))
  })
  const end = 500 + turn.tasks.length * 700
  timers.push(setTimeout(() => {
    push({
      ...current,
      status: 'streaming',
      thinkingSeconds: Math.round((Date.now() - started) / 1000),
      tasks: current.tasks.map((item) => ({ ...item, status: 'done' })),
    })
  }, end))
  timers.push(setTimeout(() => push({ ...current, status: 'done' }), end + 900))
  return () => timers.forEach(clearTimeout)
}

// One open chat. Several can be open at once, each tied to a project
// and optionally to the story it edits.
export type ChatThread = {
  id: string
  projectId: string
  storyId?: string
  storyKey?: string
  title: string
  turns: ChatTurn[]
  createdAt: number
  updatedAt: number
}

export function threadIsRunning(thread: ChatThread) {
  return thread.turns.some((turn) => turn.from === 'agent' && turn.status !== 'done')
}

const timeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
export function relativeTime(at: number) {
  const minutes = Math.round((at - Date.now()) / 60000)
  if (Math.abs(minutes) < 60) return timeFormat.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return timeFormat.format(hours, 'hour')
  return timeFormat.format(Math.round(hours / 24), 'day')
}

// The last agent proposal of a chat still waiting for the user's decision, if any.
export function pendingDecision(thread: ChatThread): AgentTurn | undefined {
  const last = [...thread.turns].reverse().find((turn): turn is AgentTurn => turn.from === 'agent')
  if (!last || last.status !== 'done' || last.decision) return undefined
  if (last.kind === 'drafts' && last.drafts.length === 0) return undefined
  return last
}

export function titleFromPrompt(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 42 ? `${clean.slice(0, 40)}…` : clean
}

const THREADS_KEY = 'atlas.storyChat.threads'

// Until the backend stores conversations, chats live in localStorage.
// A reply interrupted by a reload is closed rather than left spinning forever.
export function loadThreads(): ChatThread[] {
  try {
    const threads = JSON.parse(localStorage.getItem(THREADS_KEY) ?? '[]') as ChatThread[]
    return threads.map((thread) => ({
      ...thread,
      turns: thread.turns.map((turn) =>
        turn.from === 'agent' && turn.status !== 'done'
          ? { ...turn, status: 'done', tasks: turn.tasks.map((t) => (t.status === 'done' ? t : { ...t, status: 'failed' })) }
          : turn,
      ),
    }))
  } catch {
    return []
  }
}

export function saveThreads(threads: ChatThread[]) {
  localStorage.setItem(THREADS_KEY, JSON.stringify(threads))
}
