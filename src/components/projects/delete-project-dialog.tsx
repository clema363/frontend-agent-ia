import { useState, type FormEvent } from 'react'
import { Trash2, TriangleAlert } from 'lucide-react'
import { ProjectDialogHeader, projectDialogClassName } from '@/components/projects/project-parts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Project } from '@/lib/domain'

type DeleteProjectDialogProps = {
  project: Project
  onDelete: (projectId: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteProjectDialog({ project, onDelete, open, onOpenChange }: DeleteProjectDialogProps) {
  const [confirmation, setConfirmation] = useState('')
  const unlocked = confirmation === project.name

  function submit(event: FormEvent) {
    event.preventDefault()
    if (unlocked) onDelete(project.id)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) setConfirmation('')
        onOpenChange(value)
      }}
    >
      <DialogContent className={`${projectDialogClassName} sm:max-w-lg`}>
        <ProjectDialogHeader icon={Trash2} title="Delete project" project={project.name}>
          {project.userStories} US {project.userStories > 1 ? 'are' : 'is'} attached to it — they will remain in the
          database, without a project.
        </ProjectDialogHeader>

        <form onSubmit={submit} className="space-y-4 p-5">
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <TriangleAlert />
            <AlertDescription>This action is permanent. Type the exact project name to unlock deletion.</AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="delete-confirmation">
              Type <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{project.name}</code>
            </Label>
            <Input
              id="delete-confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={project.name}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={!unlocked}
            className="w-full bg-destructive text-white transition-all hover:bg-destructive/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            <Trash2 data-icon="inline-start" />
            Delete permanently
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
