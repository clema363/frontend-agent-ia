import { Fragment, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Bot,
  ChevronRight,
  CircleCheck,
  FileText,
  Pause,
  PenLine,
  RotateCcw,
  User,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useAgents } from '@/api/hooks'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { kanbanColumns, opencodeSteps, type AgentRequirement, type AgentsOverview, type KanbanColumnId, type StageId } from '@/lib/domain'
import { kanbanColumnStyle } from '@/lib/theme'
import { cn } from '@/lib/utils'

// How the stage agents work, read from the backend (GET /agents) so prompts and tools never drift from the code.

const columnOf = (id: KanbanColumnId) => kanbanColumns.find((column) => column.id === id)!

const requirementLabels: Record<AgentRequirement, string> = {
  jira: 'Jira',
  confluence: 'Confluence',
  repo: 'Repo',
  code: 'Repo',
  skills: 'Skills du projet',
}

function isAvailable(requires: AgentRequirement | null, integrations: AgentsOverview['integrations']) {
  if (requires === 'jira') return integrations.jira
  if (requires === 'confluence') return integrations.confluence
  // A project can also link its own repository; the page only knows the global setting.
  if (requires === 'repo' || requires === 'code') return integrations.localRepo || integrations.github
  return true
}

function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export function SchemaPage() {
  const { data, isLoading, isError } = useAgents()
  const [stage, setStage] = useState<StageId>('authoring')

  return (
    <>
      <PageHeader title="Schéma" icon={Workflow} />
      <div className="mx-auto w-full max-w-6xl space-y-12 pb-12">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Une colonne du Kanban = un agent. Chaque agent écrit un document, tu l'approuves, et seul le document approuvé
          passe à l'agent suivant, avec le journal de tes décisions. Les prompts et les outils ci-dessous sont lus
          directement dans le code du backend.
        </p>

        {isError && (
          <Alert variant="destructive">
            <AlertDescription>Impossible de charger les agents (GET /agents). Le backend est-il lancé ?</AlertDescription>
          </Alert>
        )}
        {isLoading && <Skeleton className="h-64 w-full rounded-xl" />}

        {data && (
          <>
            <Section title="Le parcours d'une US" description="Clique sur une colonne LangGraph pour voir son agent en détail plus bas.">
              <Pipeline data={data} selected={stage} onSelect={setStage} />
            </Section>

            <Section
              title="Ce que fait chaque agent, étape par étape"
              description="Les trois agents LangGraph partagent le même graphe. Une exécution démarre à la création, à l'approbation de l'étape précédente, à un message de chat ou à un refus."
            >
              <Graph data={data} />
            </Section>

            <Section title="Les agents en détail" description="Ce que chaque agent lit, les outils qu'il peut appeler, ce qu'il produit et son prompt.">
              <Tabs value={stage} onValueChange={(value) => setStage(value as StageId)} className="gap-6">
                <TabsList variant="line" aria-label="Agents">
                  {data.agents.map((agent) => (
                    <TabsTrigger key={agent.stage} value={agent.stage}>
                      {columnOf(agent.column).title}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {data.agents.map((agent) => (
                  <TabsContent key={agent.stage} value={agent.stage}>
                    <AgentDetail data={data} stage={agent.stage} />
                  </TabsContent>
                ))}
              </Tabs>
            </Section>

            <Section title="Prompts communs" description="Ajoutés aux prompts des agents, ou utilisés par les étapes partagées du graphe.">
              <div className="space-y-2">
                <Prompt title="Règles communes (incluses dans chaque prompt d'agent)" text={data.prompts.sharedRules} />
                <Prompt title="Questions avant le brouillon (modèle rapide)" text={data.prompts.questions} />
                <Prompt title="Relecteur de l'auto-vérification (modèle rapide)" text={data.prompts.critic} />
                <Prompt title="Révision après un message ou un refus" text={data.prompts.revision} />
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  )
}

type PipelineStep =
  | { kind: 'start' }
  | { kind: 'column'; column: KanbanColumnId; stage?: StageId; engine: 'LangGraph' | 'OpenCode' }

function Pipeline({ data, selected, onSelect }: { data: AgentsOverview; selected: StageId; onSelect: (stage: StageId) => void }) {
  const byColumn = new Map(data.agents.map((agent) => [agent.column, agent]))
  const steps: PipelineStep[] = [
    { kind: 'start' },
    ...kanbanColumns.map((column) => ({
      kind: 'column' as const,
      column: column.id,
      stage: byColumn.get(column.id)?.stage,
      engine: byColumn.has(column.id) ? ('LangGraph' as const) : ('OpenCode' as const),
    })),
  ]

  return (
    <div className="flex flex-wrap items-stretch gap-y-4">
      {steps.map((step, index) => {
        const agent = step.kind === 'column' ? byColumn.get(step.column) : undefined
        const arrow =
          index === 0 ? 'crée' : steps[index - 1].kind === 'column' ? approvalLabel(data, (steps[index - 1] as { column: KanbanColumnId }).column) : ''
        return (
          <Fragment key={step.kind === 'start' ? 'start' : step.column}>
            {index > 0 && (
              <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 px-1 text-center">
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-[11px] leading-tight text-muted-foreground">{arrow}</span>
              </div>
            )}
            {step.kind === 'start' ? (
              <div className="flex w-32 flex-col justify-center gap-1 rounded-xl border border-dashed p-3">
                <User className="size-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">New US</p>
                <p className="text-xs text-muted-foreground">Besoin brut + liens</p>
              </div>
            ) : (
              <button
                type="button"
                disabled={!step.stage}
                onClick={() => step.stage && onSelect(step.stage)}
                aria-pressed={step.stage === selected}
                className={cn(
                  'flex w-40 flex-col gap-1.5 rounded-xl border bg-card p-3 text-left transition-colors',
                  step.stage ? 'hover:border-primary/60' : 'cursor-default opacity-80',
                  step.stage === selected && 'border-primary ring-2 ring-primary/20',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: columnOf(step.column).color }} aria-hidden="true" />
                  <span className="text-sm font-medium">{columnOf(step.column).title}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {agent?.name ?? `Agent ${opencodeSteps.find((item) => item.column === step.column)?.agent ?? 'OpenCode'}`}
                </span>
                <Badge variant="outline" className="w-fit text-[10px]">
                  {step.engine}
                </Badge>
              </button>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function approvalLabel(data: AgentsOverview, column: KanbanColumnId) {
  const agent = data.agents.find((item) => item.column === column)
  if (agent) return `approuvé par ${agent.approvers.join(' / ')}`
  return column === 'review-for-dev' ? 'plan approuvé par DEV' : ''
}

const nodeIcons: Record<string, LucideIcon> = {
  prepare: BookOpen,
  assess: Bot,
  ask: Pause,
  draft: PenLine,
  revise: RotateCcw,
  check: CircleCheck,
  fix: Wrench,
}

function Graph({ data }: { data: AgentsOverview }) {
  const node = (id: string) => data.graph.find((item) => item.id === id)!
  const firstRun = ['prepare', 'assess', 'ask', 'draft', 'check', 'fix']
  const feedback = ['prepare', 'revise', 'check', 'fix']

  return (
    <div className="space-y-6 rounded-xl border bg-card p-5">
      <Lane data={data} title="Nouvelle exécution" hint="À la création (To author) ou après l'approbation de l'étape précédente." ids={firstRun} optional={['assess', 'ask']} />
      <Lane data={data} title="Après ton message de chat ou ton refus" hint="Même fil LangGraph : l'agent repart du document actuel, éditions comprises." ids={feedback} />
      <div className="grid gap-3 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
        {['prepare', 'assess', 'ask', 'draft', 'revise', 'check', 'fix'].map((id) => {
          const Icon = nodeIcons[id]
          return (
            <div key={id} className="space-y-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {node(id).label}
              </p>
              <p className="text-xs text-muted-foreground">{node(id).description}</p>
            </div>
          )
        })}
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Le document arrive ensuite dans l'onglet de l'étape. Tu peux l'approuver (l'US passe à la colonne suivante et l'agent
        suivant démarre), demander des changements, l'éditer ou discuter avec l'agent.
      </p>
    </div>
  )
}

function Lane({ data, title, hint, ids, optional = [] }: { data: AgentsOverview; title: string; hint: string; ids: string[]; optional?: string[] }) {
  const node = (id: string) => data.graph.find((item) => item.id === id)!
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-y-2">
        {ids.map((id, index) => {
          const Icon = nodeIcons[id]
          return (
            <Fragment key={id}>
              {index > 0 && <ArrowRight className="mx-1.5 size-3.5 text-muted-foreground" aria-hidden="true" />}
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                  optional.includes(id) && 'border-dashed text-muted-foreground',
                  id === 'ask' && 'bg-amber-500/10',
                )}
                title={node(id).description}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {node(id).label}
                {id === 'fix' && <span className="font-normal text-muted-foreground">(si problème)</span>}
                {id === 'assess' && <span className="font-normal">(To author)</span>}
              </span>
            </Fragment>
          )
        })}
        <ArrowRight className="mx-1.5 size-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground">
          <FileText className="size-3.5" aria-hidden="true" />
          Document à relire
        </span>
      </div>
    </div>
  )
}

function AgentDetail({ data, stage }: { data: AgentsOverview; stage: StageId }) {
  const agent = data.agents.find((item) => item.stage === stage)!
  const column = columnOf(agent.column)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border p-4" style={kanbanColumnStyle(column.color)}>
        <Bot className="size-4" aria-hidden="true" />
        <span className="font-medium">{agent.name}</span>
        <Badge variant="outline">Modèle : {data.models.strong}</Badge>
        <Badge variant="outline">Relecture : {data.models.fast}</Badge>
        <Badge variant="outline">Approuvé par {agent.approvers.join(' / ')}</Badge>
        {agent.asksQuestions && <Badge variant="outline">Pose des questions avant d'écrire</Badge>}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          puis <ChevronRight className="size-3" aria-hidden="true" /> {columnOf(agent.nextColumn).title}
        </span>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <Column icon={BookOpen} title="Il lit" hint="Préparé par le backend avant l'appel au modèle.">
          {agent.inputs.map((input) => (
            <Item key={input.name} label={input.label} description={input.description} requires={input.requires} data={data} />
          ))}
          <Item
            label="Context maps"
            description={`${agent.contextMaps.join(', ')} : la mémoire validée du projet (onglet Context). Une map non validée est marquée « unverified ».`}
            requires={null}
            data={data}
          />
          <Item label="Skills actifs" description="Nom et description de chaque skill. L'agent charge ceux qui s'appliquent." requires={null} data={data} />
        </Column>
        <FlowArrow />
        <Column icon={Wrench} title="Il peut appeler" hint="Outils utilisables pendant la rédaction.">
          {agent.tools.map((tool) => (
            <Item key={tool.name} label={tool.name} mono description={tool.description} requires={tool.requires} data={data} />
          ))}
          <Item label="submit_document" mono description="Envoie le document final, au format du schéma ci-contre." requires={null} data={data} />
        </Column>
        <FlowArrow />
        <Column icon={FileText} title="Il produit" hint="Schéma structuré, rendu en Markdown dans l'onglet de l'étape.">
          {agent.output.map((field) => (
            <Item key={field.name} label={field.name} mono description={field.description} requires={null} data={data} />
          ))}
        </Column>
      </div>

      <div className="space-y-2">
        <Prompt title={`Prompt système — ${agent.name}`} text={agent.systemPrompt} defaultOpen />
        <Prompt title="Checklist de l'auto-vérification" text={agent.checklist} />
      </div>
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="flex justify-center self-center text-muted-foreground" aria-hidden="true">
      <ArrowRight className="hidden size-4 lg:block" />
      <ArrowDown className="size-4 lg:hidden" />
    </div>
  )
}

function Column({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-0.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  )
}

function Item({
  label,
  description,
  requires,
  data,
  mono,
}: {
  label: string
  description: string
  requires: AgentRequirement | null
  data: AgentsOverview
  mono?: boolean
}) {
  const available = isAvailable(requires, data.integrations)
  return (
    <li className={cn('space-y-0.5', !available && 'opacity-55')}>
      <p className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className={cn('font-medium', mono && 'font-mono text-xs')}>{label}</span>
        {requires && requires !== 'skills' && (
          <Badge variant={available ? 'secondary' : 'outline'} className="text-[10px]">
            {requirementLabels[requires]}
            {!available && ' · non connecté'}
          </Badge>
        )}
      </p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </li>
  )
}

function Prompt({ title, text, defaultOpen = false }: { title: string; text: string; defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-xl border">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50">
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90" aria-hidden="true" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="max-h-[28rem] overflow-auto border-t bg-muted/40 px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{text}</pre>
      </CollapsibleContent>
    </Collapsible>
  )
}
