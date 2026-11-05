import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ExternalLink, FlaskConical, RotateCcw } from 'lucide-react'
import { AIOrbIcon } from '@/components/icons/ai-orb-icon'
import { PromptInput } from '@/components/ai/prompt-input'
import { QuestionPrompt } from '@/components/ai/question-prompt'
import { AgentActivity } from '@/components/kanban/agent-activity'
import { ApproveStoryDialog } from '@/components/kanban/approve-story-dialog'
import { CodingAgentChip, MergeRequest } from '@/components/kanban/coding-agent'
import { PageHeader } from '@/components/layout/page-header'
import AIApproval from '@/components/smoothui/ai-approval'
import AIContextMeter from '@/components/smoothui/ai-context-meter'
import type { AIState } from '@/components/smoothui/ai-core'
import AIDiff from '@/components/smoothui/ai-diff'
import AILoader, { type AILoaderVariant } from '@/components/smoothui/ai-loader'
import AIMessage from '@/components/smoothui/ai-message'
import AIOrbFace from '@/components/smoothui/ai-orb-face'
import AIPromptInput from '@/components/smoothui/ai-prompt-input'
import AIReasoning from '@/components/smoothui/ai-reasoning'
import AIResponse from '@/components/smoothui/ai-response'
import AITaskList, { type AITask } from '@/components/smoothui/ai-task-list'
import AIToolCall, { type AIToolCallStatus } from '@/components/smoothui/ai-tool-call'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { AgentQuestion, CodingAgentRun, CodingAgentStatus } from '@/lib/domain'
import { defaultOrbColors, orbPresets, setOrbColors, useOrbColors, type OrbColors } from '@/lib/orb-colors'
import { cn } from '@/lib/utils'

// Mockup page: every place where an agent works, current UI next to a SmoothUI version,
// driven by the shared AI state so each variant can be tried before replacing the real one.

const states: AIState[] = ['idle', 'thinking', 'streaming', 'done', 'error']
const stateLabels: Record<AIState, string> = {
  idle: 'En attente',
  listening: 'Écoute',
  thinking: 'Réfléchit',
  streaming: 'Écrit',
  done: 'Terminé',
  error: 'Erreur',
}

const draftText =
  '## US-142 · Export PDF des factures\n\nEn tant que comptable, je veux exporter mes factures en PDF afin de les envoyer à mes clients sans ressaisie.\n\n**Critères d’acceptation**\n- Le PDF reprend le logo et les mentions légales\n- L’export d’un lot de 50 factures prend moins de 10 secondes\n- Une facture brouillon ne peut pas être exportée'

// Plays thinking → streaming → done, like a real agent run.
function useReplay(setState: (state: AIState) => void) {
  const [run, setRun] = useState(0)
  useEffect(() => {
    if (!run) return
    setState('thinking')
    const toStream = setTimeout(() => setState('streaming'), 2200)
    const toDone = setTimeout(() => setState('done'), 5200)
    return () => {
      clearTimeout(toStream)
      clearTimeout(toDone)
    }
  }, [run, setState])
  return () => setRun((value) => value + 1)
}

// Streams `text` word by word while the state is `streaming`.
function useStreamedText(text: string, state: AIState) {
  const words = text.split(' ')
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (state !== 'streaming') return
    setCount(0)
    const timer = setInterval(() => setCount((value) => (value >= words.length ? value : value + 2)), 45)
    return () => clearInterval(timer)
  }, [state, words.length])
  if (state === 'done' || state === 'error') return text
  if (state === 'streaming') return words.slice(0, count).join(' ')
  return ''
}

function tasksFor(state: AIState, labels: string[]): AITask[] {
  return labels.map((label, index) => {
    let status: AITask['status'] = 'pending'
    if (state === 'done') status = 'done'
    if (state === 'error') status = index < 2 ? 'done' : index === 2 ? 'failed' : 'pending'
    if (state === 'thinking') status = index === 0 ? 'running' : 'pending'
    if (state === 'streaming') status = index < labels.length - 1 ? 'done' : 'running'
    return { id: label, label, status }
  })
}

function toolStatus(state: AIState, index: number): AIToolCallStatus {
  if (state === 'idle') return 'pending'
  if (state === 'error') return index === 2 ? 'error' : 'success'
  if (state === 'thinking') return index === 0 ? 'running' : 'pending'
  if (state === 'streaming') return index < 2 ? 'success' : 'running'
  return 'success'
}

function StatePicker({ value, onChange, onReplay }: { value: AIState; onChange: (state: AIState) => void; onReplay: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={value} onValueChange={(next) => onChange(next as AIState)} className="w-fit">
        <TabsList>
          {states.map((state) => (
            <TabsTrigger key={state} value={state}>{stateLabels[state]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Button size="xs" variant="ghost" onClick={onReplay}>
        <RotateCcw /> Rejouer
      </Button>
    </div>
  )
}

function Compare({ id, title, where, children, current, smooth, controls }: {
  id: string
  title: string
  where: string
  children?: ReactNode
  current: ReactNode
  smooth: ReactNode
  controls?: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-16 space-y-4 border-b pb-10 last:border-0">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{where}</p>
          {children}
        </div>
        {controls}
      </header>
      {/* No SmoothUI panel: the current component was kept, with the AI orb added. */}
      {smooth ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel label="Actuel">{current}</Panel>
          <Panel label="SmoothUI" accent>{smooth}</Panel>
        </div>
      ) : (
        <div className="max-w-xl"><Panel label="Actuel + AI Orb">{current}</Panel></div>
      )}
    </section>
  )
}

function Panel({ label, accent, children }: { label: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col rounded-2xl border bg-background', accent && 'border-brand/30 ring-3 ring-brand/5')}>
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Badge variant={accent ? 'default' : 'outline'} className={cn(accent && 'bg-brand text-on-brand')}>{label}</Badge>
      </div>
      <div className="min-w-0 flex-1 p-4">{children}</div>
    </div>
  )
}

// 0 — The building blocks on their own: loader, streamed response, context meter.
const loaderVariants: { variant: AILoaderVariant; label: string; use: string }[] = [
  { variant: 'dots', label: 'Dots', use: 'Dans une bulle de chat, en attendant le premier mot' },
  { variant: 'bar', label: 'Bar', use: 'Sous un document qui va être (ré)écrit' },
  { variant: 'grid', label: 'Grid', use: 'Sur une carte ou un panneau qui travaille en fond' },
]

const responseText =
  'J’ai relu la page Confluence « Facturation » [1] et la story US-118 [2]. Pour l’export PDF, le plus sûr est de réutiliser le rendu HTML de l’email : les mentions légales y sont déjà validées par la compta. Je propose donc un service InvoicePdfExporter qui bloque les factures brouillon et traite les lots de 50 en moins de 10 secondes.'
const responseCitations = [
  { id: 'confluence', index: 1, title: 'Confluence · Facturation' },
  { id: 'us-118', index: 2, title: 'US-118 · Envoi des factures par email' },
]

function BuildingBlocksSection() {
  const [state, setState] = useState<AIState>('streaming')
  const replay = useReplay(setState)
  const text = useStreamedText(responseText, state)
  const [used, setUsed] = useState(84_000)
  const limit = 200_000
  const share = (fraction: number) => Math.round(used * fraction)
  return (
    <section id="blocks" className="scroll-mt-16 space-y-6 border-b pb-10">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Composants IA</h2>
        <p className="text-sm text-muted-foreground">Les briques SmoothUI seules, pour les comparer avant de les placer dans l’app.</p>
      </header>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">AI Loader</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {loaderVariants.map(({ variant, label, use }) => (
            <div key={variant} className="flex flex-col gap-4 rounded-2xl border p-4">
              <div className="flex h-16 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
                <AILoader variant={variant} />
              </div>
              <div className="flex h-10 items-center justify-center text-sm text-muted-foreground">
                <AILoader variant={variant} label="Réfléchit" showElapsed />
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{use}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-sm font-medium">AI Response · streaming avec sources</h3>
          <StatePicker value={state} onChange={setState} onReplay={replay} />
        </div>
        <div className="min-h-32 rounded-2xl border p-5">
          {state === 'thinking' && <AILoader variant="dots" label="L’agent cherche dans le contexte" className="text-sm text-muted-foreground" />}
          {state === 'idle' && <p className="text-sm text-muted-foreground">Clique sur « Rejouer » pour voir la réponse s’écrire.</p>}
          {text && <AIResponse text={text} citations={responseCitations} isStreaming={state === 'streaming'} />}
          {state === 'error' && <p className="mt-2 text-sm text-destructive">La génération s’est interrompue.</p>}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">AI Context Meter</h3>
        <div className="flex flex-wrap items-center gap-6 rounded-2xl border p-5">
          <AIContextMeter
            used={used}
            limit={limit}
            breakdown={[
              { label: 'Instructions système', tokens: share(0.12) },
              { label: 'Contexte Confluence', tokens: share(0.48) },
              { label: 'Discussion', tokens: share(0.3) },
              { label: 'Outils', tokens: share(0.1) },
            ]}
          />
          <label className="flex min-w-60 flex-1 flex-col gap-2 text-sm">
            <span className="flex justify-between">
              <span>Contexte utilisé</span>
              <span className="font-mono text-xs text-muted-foreground">{used.toLocaleString('fr-FR')} / {limit.toLocaleString('fr-FR')} tokens</span>
            </span>
            <input type="range" min={0} max={limit} step={1000} value={used} onChange={(event) => setUsed(Number(event.target.value))} className="accent-brand" />
            <span className="text-xs text-muted-foreground">Survole l’anneau pour le détail. Il passe à l’orange puis au rouge quand la fenêtre se remplit.</span>
          </label>
        </div>
      </div>
    </section>
  )
}

// 1 — Stage agent writing the document (story detail, authoring/refinement/spec tabs).
function DraftingSection() {
  const [state, setState] = useState<AIState>('thinking')
  const replay = useReplay(setState)
  const text = useStreamedText(draftText, state)
  return (
    <Compare
      id="drafting"
      title="L’agent rédige le document"
      where="Kanban › détail d’une US › onglets Authoring / Refinement / Spec (agent-activity.tsx)"
      controls={<StatePicker value={state} onChange={setState} onReplay={replay} />}
      current={<AgentActivity stageId="authoring" waiting={state === 'idle'} />}
      smooth={
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <AIOrbFace size={36} state={state} gaze={false} />
            <div className="text-sm">
              <p className="font-medium">Authoring agent</p>
              <p className="text-xs text-muted-foreground">
                {state === 'idle' ? 'Réponds aux questions pour démarrer' : state === 'error' ? 'La rédaction a échoué' : state === 'done' ? 'Brouillon prêt à relire' : 'Rédige le premier brouillon…'}
              </p>
            </div>
            {(state === 'thinking' || state === 'streaming') && <AILoader variant="dots" className="ml-auto" />}
          </div>
          {state !== 'idle' && (
            <>
              <AIReasoning isStreaming={state === 'thinking'} duration={state === 'thinking' ? undefined : 3} defaultOpen>
                Le besoin brut parle d’export PDF. Je relis les pages Confluence « Facturation » et les US voisines pour réutiliser le vocabulaire du projet.
              </AIReasoning>
              <AITaskList label="Plan" tasks={tasksFor(state, ['Lire le besoin brut', 'Chercher le contexte Confluence', 'Rédiger la story', 'Écrire les critères'])} />
            </>
          )}
          {text && <AIResponse text={text} isStreaming={state === 'streaming'} className="text-sm" />}
          {state === 'thinking' && <AILoader variant="bar" label="Le document arrive" />}
        </div>
      }
    />
  )
}

// 2 — Agent status on kanban cards and list rows.
const runStatuses: CodingAgentStatus[] = ['queued', 'working', 'needs-input', 'pr-opened', 'merged', 'failed']
const statusState: Record<CodingAgentStatus, AIState> = {
  queued: 'idle',
  working: 'thinking',
  'needs-input': 'listening',
  'pr-opened': 'done',
  merged: 'done',
  failed: 'error',
}
const statusLabel: Record<CodingAgentStatus, string> = {
  queued: 'En file',
  working: 'Code…',
  'needs-input': 'Attend ta réponse',
  'pr-opened': 'MR !87',
  merged: 'Mergée',
  failed: 'Échec',
}
const run = (status: CodingAgentStatus): CodingAgentRun => ({
  agent: 'OpenCode',
  status,
  startedAt: new Date().toISOString(),
  branch: 'feature/US-142-export-pdf',
  pullRequest: status === 'pr-opened' || status === 'merged' ? { number: 87, url: '#', additions: 214, deletions: 31, ci: status === 'merged' ? 'passed' : 'pending' } : undefined,
})

function CardChipSection() {
  return (
    <Compare
      id="cards"
      title="Statut de l’agent sur les cartes"
      where="Kanban › cartes et vue liste (coding-agent.tsx › CodingAgentChip, AgentAvatar)"
      current={
        <ul className="space-y-2">
          {runStatuses.map((status) => (
            <li key={status} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>US-142 · Export PDF</span>
              <CodingAgentChip run={run(status)} />
            </li>
          ))}
        </ul>
      }
      smooth={
        <ul className="space-y-2">
          {runStatuses.map((status) => (
            <li key={status} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>US-142 · Export PDF</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AIOrbFace size={20} state={statusState[status]} gaze={false} />
                {statusLabel[status]}
              </span>
            </li>
          ))}
        </ul>
      }
    />
  )
}

// 3 — Clarifying questions asked before drafting.
const questions: AgentQuestion[] = [
  {
    header: 'Format',
    question: 'Quel format de PDF faut-il produire ?',
    options: [
      { label: 'Une facture par PDF', description: 'Le plus simple à envoyer' },
      { label: 'Un PDF par lot', description: 'Toutes les factures sélectionnées' },
    ],
  },
  {
    header: 'Accès',
    question: 'Qui peut exporter ?',
    options: [{ label: 'Comptables' }, { label: 'Tous les utilisateurs' }, { label: 'Admins seulement' }],
  },
]

function QuestionsSection() {
  const [pending, setPending] = useState(false)
  const [key, setKey] = useState(0)
  return (
    <section id="questions" className="scroll-mt-16 space-y-4 border-b pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Questions de l’agent avant de rédiger</h2>
          <p className="text-sm text-muted-foreground">Kanban › détail d’une US, au-dessus du composer (question-prompt.tsx) · ton Questionnaire, avec l’AI Orb</p>
        </div>
        <Button size="xs" variant="ghost" onClick={() => { setPending(false); setKey((k) => k + 1) }}>
          <RotateCcw /> Recommencer
        </Button>
      </header>
      <div className="mx-auto max-w-2xl">
        <QuestionPrompt
          key={key}
          agent="Authoring agent"
          questions={questions}
          pending={pending}
          onSubmit={() => setPending(true)}
          onSkipAll={() => setPending(true)}
        />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          L’orb écoute pendant que tu réponds, puis réfléchit une fois les réponses envoyées.
        </p>
      </div>
    </section>
  )
}

// 4 — Discussion and composer under a document.
function ChatSection() {
  const [state, setState] = useState<AIState>('idle')
  const replay = useReplay(setState)
  const reply = useStreamedText('C’est noté : j’ai ajouté un critère sur le lot de 50 factures et retiré la mention du format A5, qui n’était pas dans le besoin.', state)
  return (
    <Compare
      id="chat"
      title="Discussion avec l’agent et composer"
      where="Kanban › détail d’une US › « Discussion with the agent » + champ de chat ; aussi la page Skill (prompt-input.tsx)"
      controls={<StatePicker value={state} onChange={setState} onReplay={replay} />}
      current={
        <div className="flex h-full flex-col justify-between gap-6">
          <ul className="space-y-2 text-sm">
            <li className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground"><p className="mb-0.5 text-xs opacity-70">PO</p>Ajoute la contrainte de performance sur les lots.</li>
            <li className="max-w-[85%] rounded-lg bg-muted px-3 py-2"><p className="mb-0.5 text-xs opacity-70">Agent</p>C’est noté : j’ai ajouté un critère sur le lot de 50 factures.</li>
          </ul>
          <PromptInput label="Message" placeholder="Ask the authoring agent…" busy={state === 'thinking' || state === 'streaming'} onSubmit={replay} onStop={() => setState('idle')} />
        </div>
      }
      smooth={
        <div className="flex flex-col gap-4">
          <AIMessage from="user" timestamp="10:42" copyText="Ajoute la contrainte de performance sur les lots.">Ajoute la contrainte de performance sur les lots.</AIMessage>
          {state !== 'idle' && (
            <AIMessage from="assistant" avatar={<AIOrbFace size={26} state={state} gaze={false} />} copyText={reply} onRetry={replay} onVote={() => {}} bubble={false}>
              {state === 'thinking' ? <AILoader variant="dots" label="L’agent relit le document" /> : <AIResponse text={reply} isStreaming={state === 'streaming'} />}
            </AIMessage>
          )}
          <AIPromptInput aria-label="Message à l’agent" placeholder="Demande une modification à l’authoring agent…" state={state === 'done' ? 'idle' : state} onSubmit={replay} onStop={() => setState('idle')} />
        </div>
      }
    />
  )
}

// 5 — Human approval of a stage document or a plan.
function ApprovalSection() {
  const [key, setKey] = useState(0)
  return (
    <Compare
      id="approval"
      title="Validation d’un document ou d’un plan"
      where="Kanban › détail d’une US › bouton Approve (approve-story-dialog.tsx)"
      controls={<Button size="xs" variant="ghost" onClick={() => setKey((k) => k + 1)}><RotateCcw /> Recommencer</Button>}
      current={
        <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
          <span>Plan v2 prêt pour US-142</span>
          <ApproveStoryDialog storyKey="US-142" stageLabel="Plan" isPlan planVersion={2} disabled={false} pending={false} onApprove={() => {}} />
        </div>
      }
      smooth={
        <AIApproval
          key={key}
          question="Approuver le plan v2 de US-142 ?"
          options={[
            { id: 'approve', label: 'Approuver et lancer le code', detail: 'OpenCode démarre sur la branche' },
            { id: 'comment', label: 'Demander des changements', detail: 'Renvoie le plan à l’agent' },
            { id: 'reject', label: 'Rejeter le plan', destructive: true },
          ]}
        >
          <p className="text-xs text-muted-foreground">4 fichiers touchés · 2 migrations · estimation 35 min</p>
        </AIApproval>
      }
    />
  )
}

// 6 — OpenCode session: reasoning, tool calls, todos, patches.
function OpencodeSection() {
  const [state, setState] = useState<AIState>('streaming')
  const replay = useReplay(setState)
  const working = state === 'thinking' || state === 'streaming'
  const steps = (
          <div className="space-y-3 not-italic">
            <p>La facture a déjà un rendu HTML pour l’email : je le réutilise avec un moteur PDF plutôt que de dessiner un nouveau gabarit.</p>
            <AIToolCall name="read" summary="src/invoices/render.ts" status={toolStatus(state, 0)} args={<code>{'{ "path": "src/invoices/render.ts" }'}</code>} result="182 lignes" />
            <AIToolCall name="edit" summary="src/invoices/pdf-exporter.ts" status={toolStatus(state, 1)} />
            {state !== 'thinking' && (
              <AIDiff
                title="src/invoices/pdf-exporter.ts"
                lines={[
                  { kind: 'context', content: "import { renderInvoice } from './render'", number: 1 },
                  { kind: 'added', content: "import { htmlToPdf } from '@/lib/pdf'", number: 2 },
                  { kind: 'removed', content: 'export const exportInvoice = () => null', number: 3 },
                  { kind: 'added', content: 'export async function exportInvoice(invoice: Invoice) {', number: 3 },
                  { kind: 'added', content: "  if (invoice.status === 'draft') throw new DraftInvoiceError()", number: 4 },
                  { kind: 'added', content: '  return htmlToPdf(await renderInvoice(invoice))', number: 5 },
                  { kind: 'added', content: '}', number: 6 },
                ]}
              />
            )}
            <AIToolCall name="bash" summary="npm test -- invoices" status={toolStatus(state, 2)} result={state === 'error' ? '1 test en échec : export d’une facture brouillon' : '24 tests passés'} />
            <AITaskList label="Todo" tasks={tasksFor(state, ['Créer InvoicePdfExporter', 'Ajouter la route d’export', 'Bloquer les brouillons', 'Écrire les tests'])} />
          </div>
  )
  const summary = 'J’ai ajouté le service InvoicePdfExporter et la route POST /invoices/export. Les 24 tests passent, j’ouvre la merge request !87.'
  return (
    <Compare
      id="opencode"
      title="Session OpenCode (plan et code)"
      where="Kanban › détail d’une US › onglets Plan / Coding (opencode-session.tsx)"
      controls={<StatePicker value={state} onChange={setState} onReplay={replay} />}
      current={
        <div className="flex h-full flex-col items-start justify-center gap-2 text-sm text-muted-foreground">
          <p>La session actuelle (raisonnement, outils, todos, diff) se voit sur une US en colonne Coding.</p>
          <Button size="sm" variant="outline" render={<Link to="/kanban" />}>
            Ouvrir le kanban <ExternalLink />
          </Button>
        </div>
      }
      smooth={
        <div className="space-y-3">
          {/* While OpenCode works, its steps show in the flow; once the run is over they
              fold into one "Thought for…" trace so only the result stays. An error stays open. */}
          {working && steps}
          {(state === 'done' || state === 'error') && (
            <AIReasoning key={state} duration={42} defaultOpen={state === 'error'} collapseWhenDone={false}>
              {steps}
            </AIReasoning>
          )}
          {state === 'done' && <AIResponse text={summary} className="text-sm" />}
          {state === 'error' && (
            <p className="text-sm text-destructive">OpenCode s’est arrêté : 1 test en échec. Ouvre le détail ci-dessus pour voir l’étape qui a échoué.</p>
          )}
        </div>
      }
    />
  )
}

// 7 — Merge request and pipeline in the story sidebar.
function MergeRequestSection() {
  const [ci, setCi] = useState<'pending' | 'passed' | 'failed'>('pending')
  const mr: CodingAgentRun = { ...run('pr-opened'), pullRequest: { number: 87, url: '#', additions: 214, deletions: 31, ci } }
  return (
    <Compare
      id="merge-request"
      title="Merge request et pipeline"
      where="Kanban › détail d’une US › colonne de droite (coding-agent.tsx › MergeRequest) · ta carte, avec l’AI Orb pendant la pipeline et en cas d’échec"
      controls={
        <Tabs value={ci} onValueChange={(next) => setCi(next as typeof ci)} className="w-fit">
          <TabsList>
            <TabsTrigger value="pending">Pipeline en cours</TabsTrigger>
            <TabsTrigger value="passed">Réussie</TabsTrigger>
            <TabsTrigger value="failed">Échouée</TabsTrigger>
          </TabsList>
        </Tabs>
      }
      current={<div className="max-w-xs"><MergeRequest run={mr} /></div>}
      smooth={null}
    />
  )
}

// 8 — App-wide colour of the AI orb.
const colorFields: { key: keyof OrbColors; label: string; hint: string }[] = [
  { key: 'body', label: 'Corps', hint: 'La couleur principale' },
  { key: 'bodyEdge', label: 'Reflet', hint: 'Le bord clair qui marbre' },
  { key: 'feature', label: 'Yeux', hint: 'Les yeux du personnage' },
]

function OrbColorSection() {
  const stored = useOrbColors()
  const colors = stored ?? defaultOrbColors
  const activePreset = orbPresets.find((preset) => colorFields.every(({ key }) => preset.colors[key].toLowerCase() === colors[key].toLowerCase()))
  return (
    <section id="orb-color" className="scroll-mt-16 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Couleur de l’orb</h2>
          <p className="text-sm text-muted-foreground">S’applique à tous les orbs de l’app (Story chat, kanban, questions, pipeline). Enregistré dans ce navigateur.</p>
        </div>
        <Button size="xs" variant="ghost" onClick={() => setOrbColors(null)} disabled={!stored}>
          <RotateCcw /> Couleurs par défaut
        </Button>
      </header>
      <div className="grid gap-6 rounded-2xl border p-6 lg:grid-cols-[1fr_auto]">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Thèmes</p>
            <div className="flex flex-wrap gap-2">
              {orbPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setOrbColors(preset.id === 'smooth' ? null : preset.colors)}
                  aria-pressed={activePreset?.id === preset.id}
                  className={cn(
                    'flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors hover:bg-muted',
                    activePreset?.id === preset.id && 'border-foreground/40 bg-muted',
                  )}
                >
                  <span
                    className="size-6 rounded-full border"
                    style={{ backgroundImage: `radial-gradient(circle at 32% 28%, ${preset.colors.bodyEdge}, ${preset.colors.body})` }}
                    aria-hidden="true"
                  />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Sur mesure</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {colorFields.map((field) => (
                <label key={field.key} className="flex items-center gap-3 rounded-xl border p-2.5 transition-colors focus-within:border-ring hover:bg-muted/50">
                  <input
                    type="color"
                    value={colors[field.key]}
                    onChange={(event) => setOrbColors({ ...colors, [field.key]: event.target.value })}
                    className="size-9 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border [&::-webkit-color-swatch-wrapper]:p-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{field.label}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{colors[field.key]}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Le corps donne la teinte, le reflet le marbré, les yeux le contraste : garde des yeux sombres sur un corps clair, et l’inverse.</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 lg:border-l lg:pl-6">
          <AIOrbFace size={120} state="idle" />
          <div className="flex gap-3">
            {(['thinking', 'streaming', 'listening', 'done', 'error'] as AIState[]).map((state) => (
              <div key={state} className="flex flex-col items-center gap-1">
                <AIOrbFace size={36} state={state} gaze={false} />
                <span className="text-[10px] text-muted-foreground">{stateLabels[state]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// 9 — Line icon of the orb, for the nav and other monochrome spots.
function OrbIconSection() {
  return (
    <section id="orb-icon" className="scroll-mt-16 space-y-4 border-t pt-10">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Icône de l’orb</h2>
        <p className="text-sm text-muted-foreground">Version SVG monochrome de l’AI Orb Face, au format des icônes lucide (24 px, trait, currentColor). Utilisée pour « AI Lab » dans la sidebar.</p>
      </header>
      <div className="flex flex-wrap items-center gap-8 rounded-2xl border p-6">
        {[16, 20, 24, 32, 48].map((size) => (
          <div key={size} className="flex flex-col items-center gap-2">
            <AIOrbIcon size={size} />
            <span className="text-[10px] text-muted-foreground">{size}px</span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-sm">
          <AIOrbIcon className="size-4" /> AI Lab
        </div>
        <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground">
          <FlaskConical className="size-4" /> à côté d’une icône lucide
        </div>
      </div>
    </section>
  )
}

const sections = [
  { id: 'blocks', label: 'Composants IA' },
  { id: 'drafting', label: 'Rédaction' },
  { id: 'cards', label: 'Cartes kanban' },
  { id: 'questions', label: 'Questions' },
  { id: 'chat', label: 'Discussion' },
  { id: 'approval', label: 'Validation' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'merge-request', label: 'Merge request' },
  { id: 'orb-color', label: 'Couleur de l’orb' },
  { id: 'orb-icon', label: 'Icône de l’orb' },
]

export function LabPage() {
  return (
    <>
      <PageHeader title="AI Lab" icon={AIOrbIcon} />
      <div className="mx-auto w-full max-w-6xl space-y-10 px-6 py-8">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <AIOrbFace size={56} state="idle" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Maquettes SmoothUI des parties agent</h1>
              <p className="text-sm text-muted-foreground">
                Chaque bloc montre le composant actuel à gauche et sa version SmoothUI à droite. Change l’état ou clique sur « Rejouer » pour voir l’animation.
              </p>
            </div>
          </div>
          <nav aria-label="Sections" className="flex flex-wrap gap-1.5">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                {section.label}
              </a>
            ))}
          </nav>
        </div>
        <BuildingBlocksSection />
        <DraftingSection />
        <CardChipSection />
        <QuestionsSection />
        <ChatSection />
        <ApprovalSection />
        <OpencodeSection />
        <MergeRequestSection />
        <OrbColorSection />
        <OrbIconSection />
      </div>
    </>
  )
}
