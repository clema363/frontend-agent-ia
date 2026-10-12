import { useState } from 'react'
import { CircleHelp, Save } from 'lucide-react'
import { useFieldConfig, useSaveFieldConfig } from '@/api/hooks'
import { SectionHeader } from '@/components/projects/project-parts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cockpitPriorities, type FieldConfig, type JiraField, type JiraFieldGroup, type Project } from '@/lib/domain'

export function ProjectJiraFields({ project }: { project: Project }) {
  // The configuration also returns the field catalog for display.
  const { data: config } = useFieldConfig(project.id, true)

  if (!config) return <p className="text-sm text-muted-foreground">Loading…</p>
  // key: reset the form to the saved configuration after each save.
  return <FieldsForm key={JSON.stringify(config)} project={project} groups={config.catalogue} config={config} />
}

type FieldsFormProps = {
  project: Project
  groups: JiraFieldGroup[]
  config: FieldConfig
}

function FieldsForm({ project, groups, config }: FieldsFormProps) {
  const allFields = groups.flatMap((group) => group.fields)
  const lockedFieldIds = allFields.filter((field) => field.lockedHint).map((field) => field.id)
  const [selected, setSelected] = useState<string[]>(() => [...new Set([...lockedFieldIds, ...config.enabledFields])])
  const [mapping, setMapping] = useState<Record<string, string>>(config.priorityMapping)
  const jiraPriorities = config.jiraPriorities
  const save = useSaveFieldConfig(project.id)

  const initialSelection = [...new Set([...lockedFieldIds, ...config.enabledFields])]
  const dirty =
    selected.length !== initialSelection.length ||
    selected.some((id) => !initialSelection.includes(id)) ||
    cockpitPriorities.some((priority) => mapping[priority] !== config.priorityMapping[priority])

  function toggle(fieldId: string, checked: boolean) {
    setSelected((list) => (checked ? [...list, fieldId] : list.filter((id) => id !== fieldId)))
  }

  // Render two columns: Text then Lists on the left, People then Other on the right.
  const columns = [
    groups.filter((group) => group.title === 'Text' || group.title === 'Lists'),
    groups.filter((group) => group.title === 'People' || group.title === 'Other'),
  ]

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <SectionHeader title="Ticket fields" count={selected.length}>
          Fields sent with the Jira tickets. The ticket type is chosen on each US in the “New US” dialog.
        </SectionHeader>
        <div className="grid gap-x-10 gap-y-6 rounded-lg border p-5 sm:grid-cols-2">
          {columns.map((groups, index) => (
            <div key={index} className="space-y-6">
              {groups.map((group) => (
                <fieldset key={group.title} className="space-y-1">
                  <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.title}
                  </legend>
                  {group.fields.map((field) => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      checked={selected.includes(field.id)}
                      onCheckedChange={(checked) => toggle(field.id, checked)}
                    />
                  ))}
                </fieldset>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Priority mapping">Cockpit priorities and their Jira equivalent.</SectionHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cockpitPriorities.map((priority) => (
            <div key={priority} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{priority}</Label>
              <Select
                items={jiraPriorities.map((item) => ({ value: item, label: item }))}
                value={mapping[priority]}
                onValueChange={(value) => value && setMapping((current) => ({ ...current, [priority]: value }))}
              >
                <SelectTrigger className="w-full">
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
      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-lg border bg-background/95 px-4 py-2.5 shadow-sm backdrop-blur">
        <p className="text-xs text-muted-foreground tabular-nums">
          {dirty ? 'Unsaved changes · ' : ''}
          {selected.length} / {allFields.length} fields selected
        </p>
        <Button
          size="sm"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ enabledFields: selected, priorityMapping: mapping })}
        >
          <Save data-icon="inline-start" />
          Save
        </Button>
      </div>
    </div>
  )
}

type FieldRowProps = {
  field: JiraField
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function FieldRow({ field, checked, onCheckedChange }: FieldRowProps) {
  const id = `jira-field-${field.id}`
  return (
    <div className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60">
      <Checkbox
        id={id}
        checked={field.lockedHint ? true : checked}
        disabled={Boolean(field.lockedHint)}
        onCheckedChange={onCheckedChange}
      />
      <Label htmlFor={id} className={field.lockedHint ? 'text-muted-foreground' : 'cursor-pointer font-normal'}>
        {field.label}
      </Label>
      {field.lockedHint && (
        <Tooltip>
          <TooltipTrigger
            render={<button type="button" className="text-muted-foreground hover:text-foreground" />}
            aria-label={`Why ${field.label} is always sent`}
          >
            <CircleHelp className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{field.lockedHint}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
