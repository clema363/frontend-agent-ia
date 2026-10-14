import { useFieldConfig, useSaveFieldConfig } from "@/api/hooks";
import { SectionHeader } from "@/components/projects/project-parts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  cockpitPriorities,
  type FieldConfig,
  type JiraField,
  type JiraFieldGroup,
  type Project,
} from "@/lib/domain";
import { CircleHelp, Save } from "@lucide/vue";
import { defineComponent, ref } from "vue";
export const ProjectJiraFields = defineComponent(
  (__props: { project: Project }) => {
    const { project } = __props;
    const fieldConfigState0 = useFieldConfig(
      () => project.id,
      () => true,
    );
    return () => {
      const { project } = __props;
      // The configuration also returns the field catalog for display.
      const { data: config } = fieldConfigState0;
      if (!config) return <p class="text-sm text-muted-foreground">Loading…</p>;
      // key: reset the form to the saved configuration after each save.
      return (
        <FieldsForm
          key={JSON.stringify(config)}
          project={project}
          groups={config.catalogue}
          config={config}
        />
      );
    };
  },
  { name: "ProjectJiraFields", props: ["project"], inheritAttrs: false },
);
type FieldsFormProps = {
  project: Project;
  groups: JiraFieldGroup[];
  config: FieldConfig;
};
const FieldsForm = defineComponent(
  (__props: FieldsFormProps) => {
    const { project, groups, config } = __props;
    const allFields = groups.flatMap((group) => group.fields);
    const lockedFieldIds = allFields
      .filter((field) => field.lockedHint)
      .map((field) => field.id);
    const selected = ref<string[]>(
      (() => [...new Set([...lockedFieldIds, ...config.enabledFields])])(),
    );
    const setSelected = (
      next: string[] | ((current: string[]) => string[]),
    ) => {
      selected.value =
        typeof next === "function"
          ? (next as (current: typeof selected.value) => typeof selected.value)(
              selected.value,
            )
          : next;
    };
    const mapping = ref<Record<string, string>>(config.priorityMapping);
    const setMapping = (
      next:
        | Record<string, string>
        | ((current: Record<string, string>) => Record<string, string>),
    ) => {
      mapping.value =
        typeof next === "function"
          ? (next as (current: typeof mapping.value) => typeof mapping.value)(
              mapping.value,
            )
          : next;
    };
    const saveFieldConfigState1 = useSaveFieldConfig(project.id);
    return () => {
      const { groups, config } = __props;
      const allFields = groups.flatMap((group) => group.fields);
      const lockedFieldIds = allFields
        .filter((field) => field.lockedHint)
        .map((field) => field.id);
      const jiraPriorities = config.jiraPriorities;
      const save = saveFieldConfigState1;
      const initialSelection = [
        ...new Set([...lockedFieldIds, ...config.enabledFields]),
      ];
      const dirty =
        selected.value.length !== initialSelection.length ||
        selected.value.some((id) => !initialSelection.includes(id)) ||
        cockpitPriorities.some(
          (priority) =>
            mapping.value[priority] !== config.priorityMapping[priority],
        );
      function toggle(fieldId: string, checked: boolean) {
        setSelected((list) =>
          checked ? [...list, fieldId] : list.filter((id) => id !== fieldId),
        );
      }
      // Render two columns: Text then Lists on the left, People then Other on the right.
      const columns = [
        groups.filter(
          (group) => group.title === "Text" || group.title === "Lists",
        ),
        groups.filter(
          (group) => group.title === "People" || group.title === "Other",
        ),
      ];
      return (
        <div class="space-y-10">
          <section class="space-y-4">
            <SectionHeader title="Ticket fields" count={selected.value.length}>
              Fields sent with the Jira tickets. The ticket type is chosen on
              each US in the “New US” dialog.
            </SectionHeader>
            <div class="grid gap-x-10 gap-y-6 rounded-lg border p-5 sm:grid-cols-2">
              {columns.map((groups, index) => (
                <div key={index} class="space-y-6">
                  {groups.map((group) => (
                    <fieldset key={group.title} class="space-y-1">
                      <legend class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {group.title}
                      </legend>
                      {group.fields.map((field) => (
                        <FieldRow
                          key={field.id}
                          field={field}
                          checked={selected.value.includes(field.id)}
                          onCheckedChange={(checked) =>
                            toggle(field.id, checked)
                          }
                        />
                      ))}
                    </fieldset>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section class="space-y-4">
            <SectionHeader title="Priority mapping">
              Cockpit priorities and their Jira equivalent.
            </SectionHeader>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {cockpitPriorities.map((priority) => (
                <div key={priority} class="space-y-1.5">
                  <Label class="text-xs text-muted-foreground">
                    {priority}
                  </Label>
                  <Select
                    modelValue={mapping.value[priority]}
                    onUpdate:modelValue={(value) =>
                      value &&
                      setMapping((current) => ({
                        ...current,
                        [priority]: value,
                      }))
                    }
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {jiraPriorities.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>

          {/* Save bar pinned to the bottom of the view. */}
          <div class="sticky bottom-4 flex items-center justify-between gap-4 rounded-lg border bg-background/95 px-4 py-2.5 shadow-sm backdrop-blur">
            <p class="text-xs text-muted-foreground tabular-nums">
              {dirty ? "Unsaved changes · " : ""}
              {selected.value.length} / {allFields.length} fields selected
            </p>
            <Button
              size="sm"
              disabled={!dirty || save.isLoading}
              onClick={() =>
                save.trigger({
                  enabledFields: selected.value,
                  priorityMapping: mapping.value,
                })
              }
            >
              <Save data-icon="inline-start" />
              Save
            </Button>
          </div>
        </div>
      );
    };
  },
  {
    name: "FieldsForm",
    props: ["project", "groups", "config"],
    inheritAttrs: false,
  },
);
type FieldRowProps = {
  field: JiraField;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};
const FieldRow = defineComponent(
  (__props: FieldRowProps) => {
    return () => {
      const { field, checked, onCheckedChange } = __props;
      const id = `jira-field-${field.id}`;
      return (
        <div class="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60">
          <Checkbox
            id={id}
            modelValue={field.lockedHint ? true : checked}
            disabled={Boolean(field.lockedHint)}
            onUpdate:modelValue={(value) => onCheckedChange(value === true)}
          />
          <Label
            for={id}
            class={
              field.lockedHint
                ? "text-muted-foreground"
                : "cursor-pointer font-normal"
            }
          >
            {field.label}
          </Label>
          {field.lockedHint && (
            <Tooltip>
              <TooltipTrigger
                aria-label={`Why ${field.label} is always sent`}
                asChild
              >
                <button
                  type="button"
                  class="text-muted-foreground hover:text-foreground"
                >
                  <CircleHelp class="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{field.lockedHint}</TooltipContent>
            </Tooltip>
          )}
        </div>
      );
    };
  },
  {
    name: "FieldRow",
    props: ["field", "checked", "onCheckedChange"],
    inheritAttrs: false,
  },
);
