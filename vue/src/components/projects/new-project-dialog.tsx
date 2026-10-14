import {
  ProjectDialogHeader,
  projectDialogClassName,
} from "@/components/projects/project-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormEvent } from "@/lib/events";
import { FolderPlus, PlusCircle } from "@lucide/vue";
import { defineComponent, ref } from "vue";
export type NewProjectInput = {
  key: string;
  name: string;
};
export const NewProjectDialog = defineComponent(
  (__props: { onCreate: (input: NewProjectInput) => void }) => {
    const open = ref(false);
    const setOpen = (
      next:
        typeof open.value | ((current: typeof open.value) => typeof open.value),
    ) => {
      open.value =
        typeof next === "function"
          ? (next as (current: typeof open.value) => typeof open.value)(
              open.value,
            )
          : next;
    };
    const name = ref("");
    const setName = (
      next:
        typeof name.value | ((current: typeof name.value) => typeof name.value),
    ) => {
      name.value =
        typeof next === "function"
          ? (next as (current: typeof name.value) => typeof name.value)(
              name.value,
            )
          : next;
    };
    const key = ref("");
    const setKey = (
      next:
        typeof key.value | ((current: typeof key.value) => typeof key.value),
    ) => {
      key.value =
        typeof next === "function"
          ? (next as (current: typeof key.value) => typeof key.value)(key.value)
          : next;
    };
    return () => {
      const { onCreate } = __props;
      const valid = name.value.trim() !== "" && key.value.trim() !== "";
      function submit(event: FormEvent) {
        event.preventDefault();
        if (!valid) return;
        onCreate({ key: key.value.trim(), name: name.value.trim() });
        setName("");
        setKey("");
        setOpen(false);
      }
      return (
        <Dialog open={open.value} onUpdate:open={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusCircle data-icon="inline-start" />
              New project
            </Button>
          </DialogTrigger>
          <DialogContent class={`${projectDialogClassName} sm:max-w-md`}>
            <ProjectDialogHeader icon={FolderPlus} title="New project">
              Link a Jira project. Confluence and GitLab sources can be attached
              afterwards from the project context.
            </ProjectDialogHeader>

            <form onSubmit={submit} class="space-y-4 p-5">
              <div class="space-y-1.5">
                <Label for="project-name">Name</Label>
                <Input
                  id="project-name"
                  modelValue={name.value}
                  onInput={(event) =>
                    setName((event.target as HTMLInputElement).value)
                  }
                  placeholder="6804-cashgpt"
                />
              </div>
              <div class="space-y-1.5">
                <Label for="project-key">Project key</Label>
                <Input
                  id="project-key"
                  modelValue={key.value}
                  onInput={(event) =>
                    setKey(
                      (event.target as HTMLInputElement).value.toUpperCase(),
                    )
                  }
                  placeholder="TCAAS6804"
                  class="font-mono"
                />
              </div>
              <Button type="submit" size="lg" class="w-full" disabled={!valid}>
                <PlusCircle data-icon="inline-start" />
                Create project
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      );
    };
  },
  { name: "NewProjectDialog", props: ["onCreate"], inheritAttrs: false },
);
