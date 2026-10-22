import { useEffect, useState, type FormEvent } from 'react'
import { BookOpen, ChevronDown, Ellipsis, Loader, PencilLine, PlusCircle, Sparkles, Trash2, WandSparkles } from 'lucide-react'
import { ProjectDialogBody, ProjectDialogHeader, SectionHeader, projectDialogClassName } from '@/components/projects/project-parts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import type { Project } from '@/lib/domain'

// UI only for now: skills live in local state until the backend exposes them.

const skillAgents = ['Authoring agent', 'Refinement agent', 'Spec agent', 'OpenCode'] as const

type SkillAgent = (typeof skillAgents)[number]

type Skill = {
  id: string
  name: string
  description: string
  agents: SkillAgent[]
  instructions: string
  enabled: boolean
  source: 'ai' | 'manual'
}

type SkillDraft = Omit<Skill, 'id' | 'enabled' | 'source'>

const emptyDraft: SkillDraft = { name: '', description: '', agents: [], instructions: '' }

const seedSkills: Skill[] = [
  {
    id: 'skill-gherkin',
    name: 'gherkin-acceptance-criteria',
    description: 'Write acceptance criteria as Given / When / Then scenarios, one per business rule.',
    agents: ['Refinement agent', 'Spec agent'],
    instructions:
      '# Gherkin acceptance criteria\n\n- One scenario per business rule.\n- Use the vocabulary of the context maps.\n- Cover at least one error case.',
    enabled: true,
    source: 'manual',
  },
  {
    id: 'skill-api-conventions',
    name: 'api-conventions',
    description: 'Follow the REST naming, pagination and error format used by the project API.',
    agents: ['Spec agent', 'OpenCode'],
    instructions:
      '# API conventions\n\n- Plural resource names in kebab-case.\n- Cursor pagination with `next` and `limit`.\n- Errors follow RFC 9457 (problem+json).',
    enabled: false,
    source: 'ai',
  },
]

type DialogState = { mode: 'create'; tab: 'ai' | 'manual' } | { mode: 'edit'; skill: Skill } | null

export function ProjectSkills({ project }: { project: Project }) {
  const [skills, setSkills] = useState<Skill[]>(seedSkills)
  const [dialog, setDialog] = useState<DialogState>(null)
  const enabledCount = skills.filter((skill) => skill.enabled).length

  function save(draft: SkillDraft, source: Skill['source']) {
    if (dialog?.mode === 'edit') {
      setSkills((list) => list.map((skill) => (skill.id === dialog.skill.id ? { ...skill, ...draft } : skill)))
    } else {
      setSkills((list) => [...list, { ...draft, id: crypto.randomUUID(), enabled: true, source }])
    }
    setDialog(null)
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Skills"
        count={skills.length ? enabledCount : undefined}
        actions={<NewSkillMenu onSelect={(tab) => setDialog({ mode: 'create', tab })} />}
      >
        Reusable instructions the agents load when they work on this project's user stories.
      </SectionHeader>

      {skills.length === 0 ? (
        <EmptySkills onSelect={(tab) => setDialog({ mode: 'create', tab })} />
      ) : (
        <ul className="divide-y rounded-lg border text-sm">
          {skills.map((skill) => (
            <li key={skill.id} className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50">
                {skill.source === 'ai' ? (
                  <Sparkles className="size-3.5 text-muted-foreground" aria-label="Generated with AI" />
                ) : (
                  <BookOpen className="size-3.5 text-muted-foreground" aria-label="Written manually" />
                )}
              </span>
              <button
                type="button"
                onClick={() => setDialog({ mode: 'edit', skill })}
                className="min-w-0 flex-1 space-y-1 text-left"
              >
                <p className="truncate font-mono text-[13px] font-medium">{skill.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{skill.description}</p>
                <span className="flex flex-wrap gap-1 pt-0.5">
                  {skill.agents.map((agent) => (
                    <span key={agent} className="rounded border px-1.5 py-px text-[11px] leading-4 text-muted-foreground">
                      {agent}
                    </span>
                  ))}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={skill.enabled}
                  aria-label={`Enable ${skill.name}`}
                  onCheckedChange={(enabled) =>
                    setSkills((list) => list.map((item) => (item.id === skill.id ? { ...item, enabled } : item)))
                  }
                  className="mr-2"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${skill.name}`} />}>
                    <Ellipsis />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setDialog({ mode: 'edit', skill })}>
                      <PencilLine />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setSkills((list) => list.filter((item) => item.id !== skill.id))}
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className={`${projectDialogClassName} sm:max-w-2xl`}>
          {dialog?.mode === 'edit' && (
            <>
              <ProjectDialogHeader icon={PencilLine} title="Edit skill" project={project.key} />
              <ProjectDialogBody>
                <SkillEditor initial={dialog.skill} submitLabel="Save changes" onSubmit={(draft) => save(draft, dialog.skill.source)} />
              </ProjectDialogBody>
            </>
          )}
          {dialog?.mode === 'create' && (
            <>
              <ProjectDialogHeader icon={WandSparkles} title="New skill" project={project.key}>
                Describe the skill and let the AI draft it, or write it yourself.
              </ProjectDialogHeader>
              <ProjectDialogBody>
                <CreateSkill initialTab={dialog.tab} onSubmit={save} />
              </ProjectDialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NewSkillMenu({ onSelect }: { onSelect: (tab: 'ai' | 'manual') => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" />}>
        <PlusCircle data-icon="inline-start" />
        New skill
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onSelect('ai')}>
          <Sparkles />
          Generate with AI
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect('manual')}>
          <PencilLine />
          Write manually
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EmptySkills({ onSelect }: { onSelect: (tab: 'ai' | 'manual') => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg border bg-muted/50">
        <WandSparkles className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">No skills yet</p>
        <p className="text-sm text-muted-foreground">Teach the agents your conventions once, reuse them on every story.</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSelect('ai')}>
          <Sparkles data-icon="inline-start" />
          Generate with AI
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSelect('manual')}>
          <PencilLine data-icon="inline-start" />
          Write manually
        </Button>
      </div>
    </div>
  )
}

type CreateSkillProps = {
  initialTab: 'ai' | 'manual'
  onSubmit: (draft: SkillDraft, source: Skill['source']) => void
}

// Both tabs end in the same editor: the AI only pre-fills it for review.
function CreateSkill({ initialTab, onSubmit }: CreateSkillProps) {
  const [tab, setTab] = useState(initialTab)
  const [generated, setGenerated] = useState<SkillDraft | null>(null)

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as 'ai' | 'manual')} className="gap-4">
      <TabsList className="w-full">
        <TabsTrigger value="ai">
          <Sparkles />
          With AI
        </TabsTrigger>
        <TabsTrigger value="manual">
          <PencilLine />
          Manually
        </TabsTrigger>
      </TabsList>
      <TabsContent value="ai" className="animate-in fade-in-0 duration-200">
        {generated ? (
          <SkillEditor
            initial={generated}
            submitLabel="Create skill"
            onSubmit={(draft) => onSubmit(draft, 'ai')}
            onBack={() => setGenerated(null)}
          />
        ) : (
          <GenerateSkill onGenerated={setGenerated} />
        )}
      </TabsContent>
      <TabsContent value="manual" className="animate-in fade-in-0 duration-200">
        <SkillEditor initial={emptyDraft} submitLabel="Create skill" onSubmit={(draft) => onSubmit(draft, 'manual')} />
      </TabsContent>
    </Tabs>
  )
}

const promptExamples = [
  'Write acceptance criteria in Gherkin',
  'Follow our React component conventions',
  'Always list the impacted GitLab files',
]

function GenerateSkill({ onGenerated }: { onGenerated: (draft: SkillDraft) => void }) {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)

  // Placeholder for the generation endpoint: builds a plausible draft after a short delay.
  useEffect(() => {
    if (!generating) return
    const timer = window.setTimeout(() => {
      setGenerating(false)
      onGenerated(draftFromPrompt(prompt))
    }, 1400)
    return () => window.clearTimeout(timer)
  }, [generating, prompt, onGenerated])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (prompt.trim()) setGenerating(true)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="skill-prompt">What should this skill teach the agents?</Label>
        <Textarea
          id="skill-prompt"
          value={prompt}
          disabled={generating}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="e.g. When specifying an endpoint, always describe the request, the response and every error code…"
          className="min-h-32"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {promptExamples.map((example) => (
          <button
            key={example}
            type="button"
            disabled={generating}
            onClick={() => setPrompt(example)}
            className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>
      <Button type="submit" className="w-full" disabled={!prompt.trim() || generating}>
        {generating ? <Loader data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
        {generating ? 'Generating…' : 'Generate skill'}
      </Button>
    </form>
  )
}

type SkillEditorProps = {
  initial: SkillDraft
  submitLabel: string
  onSubmit: (draft: SkillDraft) => void
  onBack?: () => void
}

function SkillEditor({ initial, submitLabel, onSubmit, onBack }: SkillEditorProps) {
  const [draft, setDraft] = useState(initial)
  const valid = draft.name.trim() !== '' && draft.instructions.trim() !== '' && draft.agents.length > 0

  function update(patch: Partial<SkillDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid) onSubmit({ ...draft, name: draft.name.trim(), description: draft.description.trim() })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="skill-name">Name</Label>
        <Input
          id="skill-name"
          value={draft.name}
          onChange={(event) => update({ name: slugify(event.target.value) })}
          placeholder="api-conventions"
          className="font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="skill-description">When to use it</Label>
        <Input
          id="skill-description"
          value={draft.description}
          onChange={(event) => update({ description: event.target.value })}
          placeholder="Short description the agents read to decide when to load the skill"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Agents</Label>
        <div role="group" aria-label="Agents using the skill" className="flex flex-wrap gap-1.5">
          {skillAgents.map((agent) => {
            const pressed = draft.agents.includes(agent)
            return (
              <Toggle
                key={agent}
                variant="outline"
                size="sm"
                pressed={pressed}
                onPressedChange={() =>
                  update({ agents: pressed ? draft.agents.filter((item) => item !== agent) : [...draft.agents, agent] })
                }
                className="rounded-full px-3 transition-all active:scale-95 data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:bg-primary/85"
              >
                {agent}
              </Toggle>
            )
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="skill-instructions">Instructions (Markdown)</Label>
        <Textarea
          id="skill-instructions"
          value={draft.instructions}
          onChange={(event) => update({ instructions: event.target.value })}
          placeholder={'# My skill\n\n- Rule one\n- Rule two'}
          className="min-h-56 font-mono text-xs leading-relaxed"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>
            <Sparkles data-icon="inline-start" />
            New prompt
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={!valid}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '')
}

function draftFromPrompt(prompt: string): SkillDraft {
  const summary = prompt.trim().replace(/\s+/g, ' ')
  const name = slugify(summary.split(' ').slice(0, 4).join('-')).replace(/-+$/, '')
  return {
    name: name || 'new-skill',
    description: summary,
    agents: ['Spec agent'],
    instructions: `# ${summary}\n\n## When to apply\n\n- Whenever a user story touches this topic.\n\n## Rules\n\n- ${summary}.\n- Reuse the vocabulary of the project context maps.\n- Flag any ambiguity in the open questions section.`,
  }
}
