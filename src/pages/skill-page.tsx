import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, BookOpen, FileText, LayoutTemplate, Sparkles, Trash2, WandSparkles } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { useProjects } from '@/api/hooks'
import { PromptInput } from '@/components/ai/prompt-input'
import { PageHeader } from '@/components/layout/page-header'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  draftFromPrompt,
  emptySkillDraft,
  refineInstructions,
  skillTemplates,
  slugify,
  useSkills,
  type Skill,
  type SkillDraft,
} from '@/lib/skills'
import { cn } from '@/lib/utils'

// Skill page: /projects/:projectId/skills/new to create one, /projects/:projectId/skills/:skillId to edit it.
export function SkillPage() {
  const { projectId = '', skillId = 'new' } = useParams()
  const { data: projects, isLoading } = useProjects()
  const { skills } = useSkills(projectId)
  const project = projects?.find((item) => item.id === projectId)
  const skill = skills.find((item) => item.id === skillId)
  const backTo = `/projects/${projectId}/skills`

  if (!project || (skillId !== 'new' && !skill)) {
    return (
      <>
        <PageHeader title={isLoading ? '…' : 'Not found'} icon={WandSparkles} parent={{ label: 'Skills', to: backTo }} />
        {!isLoading && (
          <p className="text-sm text-muted-foreground">
            This skill does not exist. <Link to={backTo} className="text-primary hover:underline">Back to skills</Link>
          </p>
        )}
      </>
    )
  }

  return skill ? (
    <SkillEditor key={skill.id} projectId={projectId} projectName={project.name} skill={skill} />
  ) : (
    <NewSkill projectId={projectId} projectName={project.name} />
  )
}

type Start = { draft: SkillDraft; source: Skill['source']; prompt?: string }

// Creation starts with a choice (describe it to the AI, a template or a blank page), then opens the editor.
function NewSkill({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [start, setStart] = useState<Start | null>(null)

  if (start) return <SkillEditor projectId={projectId} projectName={projectName} start={start} />

  return (
    <>
      <PageHeader title="New skill" icon={WandSparkles} parent={{ label: projectName, to: `/projects/${projectId}/skills` }} />
      <div className="mx-auto max-w-2xl space-y-10 pt-6 lg:pt-16 animate-in fade-in-0 duration-300">
        <div className="space-y-6 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl border bg-muted/50">
            <WandSparkles className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">What should this skill teach the agents?</h2>
            <p className="text-sm text-muted-foreground">
              Describe a convention in a sentence. The AI drafts the skill, you review it before saving.
            </p>
          </div>
          <PromptInput
            label="Describe the skill"
            placeholder="e.g. When specifying an endpoint, describe the request, the response and every error code"
            onSubmit={(prompt) => setStart({ draft: emptySkillDraft, source: 'ai', prompt })}
            className="text-left shadow-sm"
          />
          <div className="flex flex-wrap justify-center gap-1.5">
            {promptExamples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setStart({ draft: emptySkillDraft, source: 'ai', prompt: example })}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            or start from
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <StartCard
              icon={FileText}
              title="Blank skill"
              description="Write the instructions yourself."
              onClick={() => setStart({ draft: emptySkillDraft, source: 'manual' })}
            />
            {skillTemplates.map((template) => (
              <StartCard
                key={template.label}
                icon={LayoutTemplate}
                title={template.label}
                description={template.draft.description}
                onClick={() => setStart({ draft: template.draft, source: 'manual' })}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

const promptExamples = [
  'Write acceptance criteria in Gherkin',
  'Follow our React component conventions',
  'Always list the impacted GitLab files',
]

type StartCardProps = { icon: typeof FileText; title: string; description: string; onClick: () => void }

function StartCard({ icon: Icon, title, description, onClick }: StartCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium">{title}</span>
        <span className="line-clamp-2 block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

// Edits a saved skill, or a new one opened from the start screen.
type SkillEditorProps = { projectId: string; projectName: string; skill?: Skill; start?: Start }

function SkillEditor({ projectId, projectName, skill, start }: SkillEditorProps) {
  const navigate = useNavigate()
  const { create, update, remove } = useSkills(projectId)
  const firstPrompt = start?.prompt
  const [saved, setSaved] = useState<SkillDraft>(skill ?? start?.draft ?? emptySkillDraft)
  const [draft, setDraft] = useState<SkillDraft>(() =>
    firstPrompt ? { ...draftFromPrompt(firstPrompt), instructions: '' } : saved,
  )
  const [source, setSource] = useState(skill?.source ?? start?.source ?? 'manual')
  const [view, setView] = useState<'write' | 'preview'>('write')
  const [showErrors, setShowErrors] = useState(false)
  const [generating, setGenerating] = useState(Boolean(firstPrompt))
  const stream = useRef<number>(undefined)
  const backTo = `/projects/${projectId}/skills`

  const errors = {
    name: !draft.name.trim() && 'Give the skill a name.',
    instructions: !draft.instructions.trim() && 'Write the instructions.',
  }
  const valid = !Object.values(errors).some(Boolean)
  const dirty = !skill || JSON.stringify(draft) !== JSON.stringify(saved)

  function patch(change: Partial<SkillDraft>) {
    setDraft((current) => ({ ...current, ...change }))
  }

  // Types the AI output into the editor, starting where it differs from the current text.
  function streamInstructions(from: string, target: string) {
    setView('write')
    setGenerating(true)
    startStream(from, target)
  }

  function startStream(from: string, target: string) {
    window.clearInterval(stream.current)
    let length = 0
    while (length < from.length && from[length] === target[length]) length++
    stream.current = window.setInterval(() => {
      length = Math.min(target.length, length + 4)
      setDraft((latest) => ({ ...latest, instructions: target.slice(0, length) }))
      if (length === target.length) stopStream()
    }, 16)
  }

  function stopStream() {
    window.clearInterval(stream.current)
    setGenerating(false)
  }

  function ask(prompt: string) {
    setSource('ai')
    if (!draft.instructions.trim()) {
      const generated = draftFromPrompt(prompt)
      setDraft((current) => ({
        ...generated,
        name: current.name || generated.name,
        description: current.description || generated.description,
        enabled: current.enabled,
        instructions: '',
      }))
      streamInstructions('', generated.instructions)
    } else {
      streamInstructions(draft.instructions, refineInstructions(draft.instructions, prompt))
    }
  }

  // The first prompt comes from the start screen: generate as soon as the editor opens.
  useEffect(() => {
    if (firstPrompt) startStream('', draftFromPrompt(firstPrompt).instructions)
    return () => window.clearInterval(stream.current)
  }, [firstPrompt]) // oxlint-disable-line react-hooks/exhaustive-deps

  function save() {
    if (!valid) return setShowErrors(true)
    const clean = { ...draft, name: draft.name.replace(/-+$/, ''), description: draft.description.trim() }
    if (skill) {
      update(skill.id, clean)
      setSaved(clean)
      setDraft(clean)
    } else {
      const created = create(clean, source)
      navigate(`${backTo}/${created.id}`, { replace: true })
    }
  }

  // Cmd/Ctrl+S saves, like in a code editor.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault()
        if (dirty && !generating) save()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <>
      <PageHeader
        title={skill ? skill.name : 'New skill'}
        icon={WandSparkles}
        parent={{ label: projectName, to: backTo }}
        actions={
          <>
            {skill && dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link to={backTo} />}>
              {skill ? <ArrowLeft data-icon="inline-start" /> : null}
              {skill ? 'Back to skills' : 'Cancel'}
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty || generating}>
              {skill ? 'Save changes' : 'Create skill'}
              <kbd className="ml-1 hidden font-sans text-[11px] opacity-60 sm:inline">⌘S</kbd>
            </Button>
          </>
        }
      />

      <div className="mx-auto grid min-h-full max-w-7xl items-start gap-10 pt-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16 lg:px-6 lg:pt-10 xl:gap-24 animate-in fade-in-0 duration-200">
        <section className="flex min-w-0 flex-col gap-6 self-stretch">
          <div className="space-y-1">
            <input
              value={draft.name}
              onChange={(event) => patch({ name: slugify(event.target.value) })}
              placeholder="skill-name"
              aria-label="Skill name"
              aria-invalid={showErrors && Boolean(errors.name)}
              autoFocus={!skill && !firstPrompt}
              className="w-full bg-transparent font-mono text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
            />
            {showErrors && errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            <Textarea
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder="When should the agents load this skill? The agents read this line to decide."
              aria-label="When to use it"
              rows={1}
              className="min-h-0 resize-none rounded-none border-0 bg-transparent px-0 py-0 text-muted-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>

          <Tabs value={view} onValueChange={(value) => setView(value as 'write' | 'preview')} className="flex-1 gap-0">
            <div
              className={cn(
                'flex flex-1 flex-col overflow-hidden rounded-lg border transition-colors focus-within:border-ring',
                showErrors && errors.instructions && 'border-destructive',
              )}
            >
              <div className="flex h-10 items-center justify-between gap-2 border-b bg-muted/30 px-2">
                <TabsList variant="line" className="h-full">
                  <TabsTrigger value="write" className="px-2">Write</TabsTrigger>
                  <TabsTrigger value="preview" className="px-2">Preview</TabsTrigger>
                </TabsList>
                <span className="flex items-center gap-1.5 pr-1 text-xs text-muted-foreground">
                  {generating && <Sparkles className="size-3.5 animate-pulse" aria-hidden="true" />}
                  {generating ? 'Writing…' : <span className="font-mono">SKILL.md</span>}
                </span>
              </div>
              <TabsContent value="write" className="flex">
                <Textarea
                  value={draft.instructions}
                  readOnly={generating}
                  onChange={(event) => patch({ instructions: event.target.value })}
                  placeholder={'# My skill\n\n## When to apply\n\n- …\n\n## Rules\n\n- …\n\nOr describe what you want below and let the AI write it.'}
                  aria-label="Instructions (Markdown)"
                  className="min-h-80 flex-1 resize-none rounded-none border-0 bg-transparent p-4 font-mono text-[13px] leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
              </TabsContent>
              <TabsContent value="preview" className="min-h-80 p-4">
                {draft.instructions.trim() ? (
                  <Markdown className="[&_h1]:text-lg [&_h1]:font-semibold">{draft.instructions}</Markdown>
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                )}
              </TabsContent>
            </div>
          </Tabs>
          {showErrors && errors.instructions && <p className="-mt-4 text-xs text-destructive">{errors.instructions}</p>}

          {/* Pinned to the bottom of the page scroller, like the story chat composer. */}
          <div className="sticky -bottom-10 z-10 -mb-10 mt-auto bg-linear-to-t from-background from-75% to-transparent pt-6 pb-3">
            <PromptInput
              label="Ask the AI"
              placeholder={
                draft.instructions.trim()
                  ? 'Ask the AI to change the skill, e.g. "add a rule about error cases"'
                  : 'Describe the skill and let the AI write it'
              }
              busy={generating}
              onSubmit={ask}
              onStop={stopStream}
            />
          </div>
        </section>

        <aside aria-label="Skill settings" className="space-y-8 border-t pt-6 lg:sticky lg:top-6 lg:border-t-0 lg:pt-2">
          <section className="space-y-3 border-b pb-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Enabled</h2>
              <Switch checked={draft.enabled} onCheckedChange={(enabled) => patch({ enabled })} aria-label="Enable the skill" />
            </div>
            <p className="text-xs text-muted-foreground">Disabled skills stay here but are never loaded by the agents.</p>
          </section>


          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground">Details</h2>
            <dl className="space-y-4">
              <Detail label="Source" icon={source === 'ai' ? <Sparkles /> : <BookOpen />}>
                {source === 'ai' ? 'Drafted with AI' : 'Written manually'}
              </Detail>
              <Detail label="File" icon={<FileText />}>
                <span className="font-mono text-xs break-all">skills/{draft.name || 'skill-name'}/SKILL.md</span>
              </Detail>
              {skill && <Detail label="Last saved">{new Date(skill.updatedAt).toLocaleString()}</Detail>}
            </dl>
          </section>

          {skill && (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 text-destructive hover:text-destructive"
              onClick={() => {
                remove(skill.id)
                navigate(backTo)
              }}
            >
              <Trash2 data-icon="inline-start" />
              Delete skill
            </Button>
          )}
        </aside>
      </div>
    </>
  )
}

function Detail({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-start gap-2 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
        {icon}
        <span className="min-w-0">{children}</span>
      </dd>
    </div>
  )
}
