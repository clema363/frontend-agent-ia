import { IssueTypeIcon, PriorityIcon } from "@/components/kanban/issue-meta";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  issueTypes,
  priorities,
  type IssueType,
  type Priority,
  type Project,
  type UserStory,
} from "@/lib/domain";
import type { FormEvent } from "@/lib/events";
import { PlusCircle } from "@lucide/vue";
import { defineComponent, ref, type VNodeChild } from "vue";
export type NewStoryInput = Pick<
  UserStory,
  | "type"
  | "title"
  | "priority"
  | "projectId"
  | "raw"
  | "contextLinks"
  | "parentKey"
>;
const NO_PARENT = "none";
type NewStoryDialogProps = {
  projects: Project[];
  epics: UserStory[];
  onCreate: (input: NewStoryInput) => void;
};
export const NewStoryDialog = defineComponent(
  (__props: NewStoryDialogProps) => {
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
    const type = ref<IssueType>("Story");
    const setType = (next: IssueType | ((current: IssueType) => IssueType)) => {
      type.value =
        typeof next === "function"
          ? (next as (current: typeof type.value) => typeof type.value)(
              type.value,
            )
          : next;
    };
    const selectedProjectId = ref<string | undefined>(undefined);
    const setProjectId = (
      next:
        | string
        | undefined
        | ((current: string | undefined) => string | undefined),
    ) => {
      selectedProjectId.value =
        typeof next === "function"
          ? (
              next as (
                current: typeof selectedProjectId.value,
              ) => typeof selectedProjectId.value
            )(selectedProjectId.value)
          : next;
    };
    // Projects come from the API; select the first one by default once loaded.

    const priority = ref<Priority>("Medium");
    const setPriority = (
      next: Priority | ((current: Priority) => Priority),
    ) => {
      priority.value =
        typeof next === "function"
          ? (next as (current: typeof priority.value) => typeof priority.value)(
              priority.value,
            )
          : next;
    };
    const parentKey = ref(NO_PARENT);
    const setParentKey = (
      next:
        | typeof parentKey.value
        | ((current: typeof parentKey.value) => typeof parentKey.value),
    ) => {
      parentKey.value =
        typeof next === "function"
          ? (
              next as (
                current: typeof parentKey.value,
              ) => typeof parentKey.value
            )(parentKey.value)
          : next;
    };
    const title = ref("");
    const setTitle = (
      next:
        | typeof title.value
        | ((current: typeof title.value) => typeof title.value),
    ) => {
      title.value =
        typeof next === "function"
          ? (next as (current: typeof title.value) => typeof title.value)(
              title.value,
            )
          : next;
    };
    const raw = ref("");
    const setRaw = (
      next:
        typeof raw.value | ((current: typeof raw.value) => typeof raw.value),
    ) => {
      raw.value =
        typeof next === "function"
          ? (next as (current: typeof raw.value) => typeof raw.value)(raw.value)
          : next;
    };
    const links = ref("");
    const setLinks = (
      next:
        | typeof links.value
        | ((current: typeof links.value) => typeof links.value),
    ) => {
      links.value =
        typeof next === "function"
          ? (next as (current: typeof links.value) => typeof links.value)(
              links.value,
            )
          : next;
    };
    return () => {
      const { projects, epics, onCreate } = __props;
      // Projects come from the API; select the first one by default once loaded.
      const projectId = selectedProjectId.value ?? projects[0]?.id ?? "";
      const projectEpics = epics.filter((epic) => epic.projectId === projectId);
      function reset() {
        setType("Story");
        setPriority("Medium");
        setParentKey(NO_PARENT);
        setTitle("");
        setRaw("");
        setLinks("");
      }
      function submit(event: FormEvent) {
        event.preventDefault();
        if (!raw.value.trim()) return;
        onCreate({
          type: type.value,
          projectId,
          priority: priority.value,
          parentKey:
            parentKey.value === NO_PARENT ? undefined : parentKey.value,
          title: title.value.trim(),
          raw: raw.value.trim(),
          contextLinks: links.value
            .split("\n")
            .map((link) => link.trim())
            .filter(Boolean),
        });
        reset();
        setOpen(false);
      }
      return (
        <Dialog open={open.value} onUpdate:open={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusCircle data-icon="inline-start" />
              New US
            </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-xl">
            <form onSubmit={submit} class="space-y-4">
              <DialogHeader>
                <DialogTitle>New user story</DialogTitle>
                <DialogDescription>
                  Write what you want in your own words. The authoring agent
                  turns it into a clean draft.
                </DialogDescription>
              </DialogHeader>

              <div class="grid gap-3 sm:grid-cols-3">
                <Field label="Type">
                  <Select
                    modelValue={type.value}
                    onUpdate:modelValue={(value) =>
                      value && setType(value as IssueType)
                    }
                  >
                    <SelectTrigger class="w-full">
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
                    modelValue={projectId}
                    onUpdate:modelValue={(value) => {
                      if (!value) return;
                      setProjectId(value);
                      setParentKey(NO_PARENT);
                    }}
                  >
                    <SelectTrigger class="w-full">
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
                    modelValue={priority.value}
                    onUpdate:modelValue={(value) =>
                      value && setPriority(value as Priority)
                    }
                  >
                    <SelectTrigger class="w-full">
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

              {type.value !== "Epic" && (
                <Field label="Parent epic">
                  <Select
                    modelValue={parentKey.value}
                    onUpdate:modelValue={(value) =>
                      setParentKey(value ?? NO_PARENT)
                    }
                  >
                    <SelectTrigger class="w-full">
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

              <Field
                label="Title"
                htmlFor="story-title"
                hint="Optional: the agent suggests one if empty."
              >
                <Input
                  id="story-title"
                  modelValue={title.value}
                  onInput={(event) =>
                    setTitle((event.target as HTMLInputElement).value)
                  }
                />
              </Field>

              <Field
                label="What do you want?"
                htmlFor="story-raw"
                hint="Raw notes are fine: needs, context, examples, constraints."
              >
                <Textarea
                  id="story-raw"
                  required
                  modelValue={raw.value}
                  onInput={(event) =>
                    setRaw((event.target as HTMLInputElement).value)
                  }
                  placeholder="e.g. when the bank rejects a payment, the treasurer must know before the cut-off…"
                  class="min-h-32"
                />
              </Field>

              <Field
                label="Context links"
                htmlFor="story-links"
                hint="Optional: Jira tickets or Confluence pages, one per line."
              >
                <Textarea
                  id="story-links"
                  modelValue={links.value}
                  onInput={(event) =>
                    setLinks((event.target as HTMLInputElement).value)
                  }
                  placeholder="https://confluence.example.com/…"
                  class="min-h-16 font-mono text-xs"
                />
              </Field>

              <DialogFooter>
                <Button type="submit" disabled={!raw.value.trim()}>
                  Create and send to the authoring agent
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      );
    };
  },
  {
    name: "NewStoryDialog",
    props: ["projects", "epics", "onCreate"],
    inheritAttrs: false,
  },
);
type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  children?: VNodeChild;
};
const Field = defineComponent(
  (__props: FieldProps, { slots }) => {
    return () => {
      const { label, htmlFor, hint, children } = {
        ...__props,
        children: slots.default?.(),
      };
      return (
        <div class="space-y-1.5">
          <Label for={htmlFor}>{label}</Label>
          {children}
          {hint && <p class="text-xs text-muted-foreground">{hint}</p>}
        </div>
      );
    };
  },
  { name: "Field", props: ["label", "htmlFor", "hint"], inheritAttrs: false },
);
