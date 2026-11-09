import { createSpecStreamCompiler, type Spec } from '@json-render/core'
import type { AITask } from '@/components/smoothui/ai-task-list'

// UI-only model of the insights chat. The backend agent is not wired yet:
// `simulateInsightsReply` streams hand-written json-render specs as JSONL patches,
// exactly the format the real agent will send (one RFC 6902 patch per line).
// Replace it with a fetch on the backend stream fed into the same compiler.

export type InsightsAgentTurn = {
  id: string
  from: 'agent'
  status: 'thinking' | 'streaming' | 'done'
  tasks: AITask[]
  text: string
  spec: Spec | null
}
export type InsightsUserTurn = { id: string; from: 'user'; text: string }
export type InsightsTurn = InsightsUserTurn | InsightsAgentTurn

export const insightsSuggestions = [
  'Tokens consommés sur les 30 derniers jours',
  'Qui lance le plus de chats ?',
  'Tokens par projet et par semaine',
  'Quel agent coûte le plus ?',
]

type Patch = { op: 'add'; path: string; value: unknown }

// Deterministic pseudo-random numbers so the demo looks the same on every reload.
function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function isoDay(offset: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - offset)
  return date.toISOString().slice(0, 10)
}

const people = ['Clément A.', 'Sarah M.', 'Hugo L.', 'Inès B.', 'Thomas R.', 'Léa D.']
const agents = ['Story chat', 'Authoring', 'Refinement', 'OpenCode', 'Revue de code']
const projects = ['6804-cashgpt', '7120-treasury-portal', '7311-onboarding']

function element(key: string, type: string, props: Record<string, unknown>, children: string[] = []): Patch {
  return { op: 'add', path: `/elements/${key}`, value: { type, props, children } }
}
const state = (path: string, value: unknown): Patch => ({ op: 'add', path: `/state${path}`, value })
const bind = (path: string) => ({ $state: path })

function tokensReply(): { text: string; tasks: string[]; patches: Patch[] } {
  const random = seeded(42)
  const days = Array.from({ length: 30 }, (_, index) => {
    const weekend = [0, 6].includes(new Date(isoDay(29 - index)).getDay())
    const base = weekend ? 0.25 : 1
    const input = Math.round((380_000 + random() * 260_000 + index * 6_000) * base)
    return { day: isoDay(29 - index), input, output: Math.round(input * (0.22 + random() * 0.08)) }
  })
  const total = days.reduce((sum, day) => sum + day.input + day.output, 0)
  const byAgent = agents.map((name, index) => ({ agent: name, tokens: Math.round(total * [0.31, 0.24, 0.12, 0.26, 0.07][index]) }))
  return {
    text: `Sur les 30 derniers jours, l’équipe a consommé **${(total / 1e6).toFixed(1)} M de tokens**, avec un pic en semaine et un creux le week-end. OpenCode et le story chat représentent plus de la moitié de la consommation.`,
    tasks: ['Lire l’usage des tokens (30 jours)', 'Répartir par agent', 'Composer le tableau de bord'],
    patches: [
      { op: 'add', path: '/root', value: 'root' },
      element('root', 'Stack', { gap: 'md' }, ['kpis', 'trend', 'split']),
      element('kpis', 'Grid', { columns: 3 }, ['kpi-total', 'kpi-cost', 'kpi-avg']),
      element('kpi-total', 'Metric', { label: 'Tokens consommés', value: total, unit: null, change: 18.4, changeLabel: 'vs mois précédent', higherIsBetter: false }),
      element('kpi-cost', 'Metric', { label: 'Coût estimé', value: `${Math.round(total * 0.0000042)} €`, unit: null, change: 12.1, changeLabel: 'vs mois précédent', higherIsBetter: false }),
      element('kpi-avg', 'Metric', { label: 'Moyenne par jour ouvré', value: Math.round(total / 22), unit: 'tokens', change: null, changeLabel: null, higherIsBetter: null }),
      element('trend', 'Card', { title: 'Tokens par jour', description: 'Entrée et sortie, 30 derniers jours' }, ['trend-chart']),
      element('trend-chart', 'LineChart', {
        data: bind('/usage/daily'),
        xKey: 'day',
        series: [{ key: 'input', label: 'Entrée' }, { key: 'output', label: 'Sortie' }],
        unit: 'tokens',
        area: true,
      }),
      state('/usage', { daily: days }),
      element('split', 'Card', { title: 'Répartition par agent', description: null }, ['split-chart']),
      element('split-chart', 'DonutChart', { data: bind('/usage/byAgent'), nameKey: 'agent', valueKey: 'tokens', unit: 'tokens' }),
      state('/usage/byAgent', byAgent),
    ],
  }
}

function chatsReply(): { text: string; tasks: string[]; patches: Patch[] } {
  const random = seeded(7)
  const rows = people
    .map((person) => {
      const chats = Math.round(12 + random() * 70)
      const stories = Math.round(chats * (0.8 + random() * 1.6))
      return { person, chats, stories, accepted: Math.round(55 + random() * 40) }
    })
    .sort((a, b) => b.chats - a.chats)
  const totalChats = rows.reduce((sum, row) => sum + row.chats, 0)
  const totalStories = rows.reduce((sum, row) => sum + row.stories, 0)
  return {
    text: `**${rows[0].person}** lance le plus de chats ce mois-ci (${rows[0].chats}), devant ${rows[1].person} et ${rows[2].person}. Le tableau détaille aussi les US créées et le taux de propositions acceptées.`,
    tasks: ['Compter les chats par personne', 'Joindre les US créées', 'Composer le classement'],
    patches: [
      { op: 'add', path: '/root', value: 'root' },
      element('root', 'Stack', { gap: 'md' }, ['kpis', 'ranking', 'details']),
      element('kpis', 'Grid', { columns: 3 }, ['kpi-chats', 'kpi-people', 'kpi-stories']),
      element('kpi-chats', 'Metric', { label: 'Chats lancés', value: totalChats, unit: null, change: 9.6, changeLabel: 'vs mois précédent', higherIsBetter: true }),
      element('kpi-people', 'Metric', { label: 'Personnes actives', value: rows.length, unit: null, change: null, changeLabel: null, higherIsBetter: null }),
      element('kpi-stories', 'Metric', { label: 'US créées depuis un chat', value: totalStories, unit: null, change: 21.3, changeLabel: 'vs mois précédent', higherIsBetter: true }),
      element('ranking', 'Card', { title: 'Chats par personne', description: '30 derniers jours' }, ['ranking-chart']),
      element('ranking-chart', 'BarChart', {
        data: bind('/chats/byPerson'),
        xKey: 'person',
        series: [{ key: 'chats', label: 'Chats' }],
        unit: 'chats',
        horizontal: true,
        stacked: null,
      }),
      state('/chats', { byPerson: rows }),
      element('details', 'Card', { title: 'Détail', description: null }, ['details-table']),
      element('details-table', 'Table', {
        data: bind('/chats/byPerson'),
        columns: [
          { key: 'person', label: 'Personne', align: null, format: 'text' },
          { key: 'chats', label: 'Chats', align: 'right', format: 'number' },
          { key: 'stories', label: 'US créées', align: 'right', format: 'number' },
          { key: 'accepted', label: 'Acceptées', align: 'right', format: 'percent' },
        ],
      }),
    ],
  }
}

function projectsReply(): { text: string; tasks: string[]; patches: Patch[] } {
  const random = seeded(99)
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const row: Record<string, string | number> = { week: isoDay((7 - index) * 7) }
    projects.forEach((project, p) => {
      row[project] = Math.round((p === 0 ? 1.4e6 : p === 1 ? 0.9e6 : 0.3e6) * (0.7 + random() * 0.6) * (1 + index * 0.05))
    })
    return row
  })
  return {
    text: `**${projects[0]}** reste le projet le plus consommateur chaque semaine. ${projects[2]} démarre doucement depuis deux semaines.`,
    tasks: ['Lire l’usage des tokens (8 semaines)', 'Grouper par projet', 'Composer le graphique'],
    patches: [
      { op: 'add', path: '/root', value: 'root' },
      element('root', 'Stack', { gap: 'md' }, ['badges', 'weekly']),
      element('badges', 'Grid', { columns: 3 }, projects.map((_, index) => `badge-${index}`)),
      ...projects.map((project, index) =>
        element(`badge-${index}`, 'Metric', {
          label: project,
          value: weeks.reduce((sum, week) => sum + Number(week[project]), 0),
          unit: 'tokens',
          change: [6.2, -3.8, 140][index],
          changeLabel: 'sur 4 semaines',
          higherIsBetter: false,
        }),
      ),
      element('weekly', 'Card', { title: 'Tokens par projet et par semaine', description: 'Semaine commençant le' }, ['weekly-chart']),
      element('weekly-chart', 'BarChart', {
        data: bind('/usage/weekly'),
        xKey: 'week',
        series: projects.map((project) => ({ key: project, label: project })),
        unit: 'tokens',
        horizontal: null,
        stacked: true,
      }),
      state('/usage', { weekly: weeks }),
    ],
  }
}

function pickReply(prompt: string) {
  const text = prompt.toLowerCase()
  if (/chat|qui|personne|utilisateur|équipe/.test(text)) return chatsReply()
  if (/projet|semaine/.test(text)) return projectsReply()
  return tokensReply()
}

export function buildInsightsTurn(id: string, prompt: string): InsightsAgentTurn {
  const reply = pickReply(prompt)
  return {
    id,
    from: 'agent',
    status: 'thinking',
    tasks: reply.tasks.map((label, index) => ({ id: `${id}-t${index}`, label, status: 'pending' })),
    text: '',
    spec: null,
  }
}

// Plays the reply forward: tool calls run, then the text and the spec stream in patch by patch.
export function simulateInsightsReply(turn: InsightsAgentTurn, prompt: string, update: (next: InsightsAgentTurn) => void) {
  const reply = pickReply(prompt)
  const timers: ReturnType<typeof setTimeout>[] = []
  let current = turn
  const set = (next: InsightsAgentTurn) => {
    current = next
    update(next)
  }
  let at = 0
  current.tasks.forEach((_, index) => {
    timers.push(setTimeout(() => set({ ...current, tasks: current.tasks.map((t, i) => ({ ...t, status: i < index ? 'done' : i === index ? 'running' : 'pending' })) }), at))
    at += 650
  })
  timers.push(setTimeout(() => set({ ...current, status: 'streaming', text: reply.text, tasks: current.tasks.map((t) => ({ ...t, status: 'done' })) }), at))

  const compiler = createSpecStreamCompiler<Spec>()
  reply.patches.forEach((patch) => {
    at += 140
    timers.push(
      setTimeout(() => {
        const { result } = compiler.push(`${JSON.stringify(patch)}\n`)
        set({ ...current, spec: structuredClone(result) })
      }, at),
    )
  })
  timers.push(setTimeout(() => set({ ...current, status: 'done' }), at + 200))
  return () => timers.forEach(clearTimeout)
}
