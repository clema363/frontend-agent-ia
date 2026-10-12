import { useState, type FormEvent, type ReactNode } from 'react'
import { PlusCircle } from 'lucide-react'
import { IssueTypeIcon, PriorityIcon } from '@/components/kanban/issue-meta'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { issueTypes, priorities, type IssueType, type Priority, type Project, type UserStory } from '@/lib/domain'

export type NewStoryInput = Pick<UserStory, 'type' | 'title' | 'priority' | 'projectId' | 'raw' | 'contextLinks' | 'parentKey'>

const NO_PARENT = 'none'

type NewStoryDialogProps = {
  projects: Project[]
  epics: UserStory[]
  onCreate: (input: NewStoryInput) => void
}

export function NewStoryDialog({ projects, epics, onCreate }: NewStoryDialogProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<IssueType>('Story')
  const [selectedProjectId, setProjectId] = useState<string>()
  // Les projets arrivent de l'API : le premier est choisi par défaut une fois chargé.
  const projectId = selectedProjectId ?? projects[0]?.id ?? ''
  const [priority, setPriority] = useState<Priority>('Medium')
  const [parentKey, setParentKey] = useState(NO_PARENT)
  const [title, setTitle] = useState('')
  const [raw, setRaw] = useState('')
  const [links, setLinks] = useState('')

  const projectEpics = epics.filter((epic) => epic.projectId === projectId)

  function reset() {
    setType('Story')
    setPriority('Medium')
    setParentKey(NO_PARENT)
    setTitle('')
    setRaw('')
    setLinks('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!raw.trim()) return
    onCreate({
      type,
      projectId,
      priority,
      parentKey: parentKey === NO_PARENT ? undefined : parentKey,
      title: title.trim(),
      raw: raw.trim(),
      contextLinks: links
        .split('\n')
        .map((link) => link.trim())
        .filter(Boolean),
    })
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PlusCircle data-icon="inline-start" />
        New US
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New user story</DialogTitle>
            <DialogDescription>
              Write what you want in your own words. The authoring agent turns it into a clean draft.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <Select
                items={issueTypes.map((item) => ({ value: item, label: item }))}
                value={type}
                onValueChange={(value) => value && setType(value as IssueType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {issueTypes.map((item) => (
                    <SelectItem key={item} value={item}>
                      <IssueTypeIcon type={item} />
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Project">
              <Select
                items={projects.map((project) => ({ value: project.id, label: project.name }))}
                value={projectId}
                onValueChange={(value) => {
                  if (!value) return
                  setProjectId(value)
                  setParentKey(NO_PARENT)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select
                items={priorities.map((item) => ({ value: item, label: item }))}
                value={priority}
                onValueChange={(value) => value && setPriority(value as Priority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((item) => (
                    <SelectItem key={item} value={item}>
                      <PriorityIcon priority={item} />
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {type !== 'Epic' && (
            <Field label="Parent epic">
              <Select
                items={[
                  { value: NO_PARENT, label: 'No epic' },
                  ...projectEpics.map((epic) => ({ value: epic.key, label: `${epic.key} · ${epic.title}` })),
                ]}
                value={parentKey}
                onValueChange={(value) => setParentKey(value ?? NO_PARENT)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>No epic</SelectItem>
                  {projectEpics.map((epic) => (
                    <SelectItem key={epic.key} value={epic.key}>
                      {epic.key} · {epic.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Title" htmlFor="story-title" hint="Optional: the agent suggests one if empty.">
            <Input id="story-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>

          <Field label="What do you want?" htmlFor="story-raw" hint="Raw notes are fine: needs, context, examples, constraints.">
            <Textarea
              id="story-raw"
              required
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder="e.g. when the bank rejects a payment, the treasurer must know before the cut-off…"
              className="min-h-32"
            />
          </Field>

          <Field label="Context links" htmlFor="story-links" hint="Optional: Jira tickets or Confluence pages, one per line.">
            <Textarea
              id="story-links"
              value={links}
              onChange={(event) => setLinks(event.target.value)}
              placeholder="https://confluence.example.com/…"
              className="min-h-16 font-mono text-xs"
            />
          </Field>

          <DialogFooter>
            <Button type="submit" disabled={!raw.trim()}>
              Create and send to the authoring agent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type FieldProps = {
  label: string
  htmlFor?: string
  hint?: string
  children: ReactNode
}

function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
