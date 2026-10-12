import { useState, type FormEvent } from 'react'
import { FolderPlus, PlusCircle } from 'lucide-react'
import { ProjectDialogHeader, projectDialogClassName } from '@/components/projects/project-parts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type NewProjectInput = { key: string; name: string }

export function NewProjectDialog({ onCreate }: { onCreate: (input: NewProjectInput) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const valid = name.trim() !== '' && key.trim() !== ''

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    onCreate({ key: key.trim(), name: name.trim() })
    setName('')
    setKey('')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PlusCircle data-icon="inline-start" />
        New project
      </DialogTrigger>
      <DialogContent className={`${projectDialogClassName} sm:max-w-md`}>
        <ProjectDialogHeader icon={FolderPlus} title="New project">
          Link a Jira project. Confluence and GitLab sources can be attached afterwards from the project context.
        </ProjectDialogHeader>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="6804-cashgpt" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-key">Project key</Label>
            <Input
              id="project-key"
              value={key}
              onChange={(event) => setKey(event.target.value.toUpperCase())}
              placeholder="TCAAS6804"
              className="font-mono"
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={!valid}>
            <PlusCircle data-icon="inline-start" />
            Create project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
