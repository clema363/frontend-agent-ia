import {
  ProjectDialogHeader,
  projectDialogClassName,
} from "@/components/projects/project-parts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/lib/domain";
import type { FormEvent } from "@/lib/events";
import { Trash2, TriangleAlert } from "@lucide/vue";
import { defineComponent, ref } from "vue";
type DeleteProjectDialogProps = {
  project: Project;
  onDelete: (projectId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
export const DeleteProjectDialog = defineComponent(
  (__props: DeleteProjectDialogProps) => {
    const confirmation = ref("");
    const setConfirmation = (
      next:
        | typeof confirmation.value
        | ((current: typeof confirmation.value) => typeof confirmation.value),
    ) => {
      confirmation.value =
        typeof next === "function"
          ? (
              next as (
                current: typeof confirmation.value,
              ) => typeof confirmation.value
            )(confirmation.value)
          : next;
    };
    return () => {
      const { project, onDelete, open, onOpenChange } = __props;
      const unlocked = confirmation.value === project.name;
      function submit(event: FormEvent) {
        event.preventDefault();
        if (unlocked) onDelete(project.id);
      }
      return (
        <Dialog
          open={open}
          onUpdate:open={(value) => {
            if (!value) setConfirmation("");
            onOpenChange(value);
          }}
        >
          <DialogContent class={`${projectDialogClassName} sm:max-w-lg`}>
            <ProjectDialogHeader
              icon={Trash2}
              title="Delete project"
              project={project.name}
            >
              {project.userStories} US {project.userStories > 1 ? "are" : "is"}{" "}
              attached to it — they will remain in the database, without a
              project.
            </ProjectDialogHeader>

            <form onSubmit={submit} class="space-y-4 p-5">
              <Alert
                variant="destructive"
                class="border-destructive/30 bg-destructive/5"
              >
                <TriangleAlert />
                <AlertDescription>
                  This action is permanent. Type the exact project name to
                  unlock deletion.
                </AlertDescription>
              </Alert>

              <div class="space-y-1.5">
                <Label for="delete-confirmation">
                  Type{" "}
                  <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {project.name}
                  </code>
                </Label>
                <Input
                  id="delete-confirmation"
                  autoComplete="off"
                  modelValue={confirmation.value}
                  onInput={(event) =>
                    setConfirmation((event.target as HTMLInputElement).value)
                  }
                  placeholder={project.name}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={!unlocked}
                class="w-full bg-destructive text-white transition-all hover:bg-destructive/90 disabled:bg-muted disabled:text-muted-foreground"
              >
                <Trash2 data-icon="inline-start" />
                Delete permanently
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      );
    };
  },
  {
    name: "DeleteProjectDialog",
    props: ["project", "onDelete", "open", "onOpenChange"],
    inheritAttrs: false,
  },
);
