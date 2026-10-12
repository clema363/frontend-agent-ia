import { useState } from 'react'
import { CircleCheck, Link2, Unlink } from 'lucide-react'
import {
  useConfluenceSpaces,
  useConnections,
  useGitlabProjects,
  useJiraProjects,
  useMe,
  useProjectMutations,
  useSettings,
} from '@/api/hooks'
import { SectionHeader } from '@/components/projects/project-parts'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Project, ProjectSources, SourceTool } from '@/lib/domain'

// Sources lues par les agents : projet Jira, espace Confluence, dépôt GitLab.
export function SourcesSection({ project }: { project: Project }) {
  const { data: me } = useMe()
  const { data: jiraProjects = [] } = useJiraProjects(true)
  const { data: spaces = [] } = useConfluenceSpaces(true)
  const { data: repositories = [] } = useGitlabProjects(true)
  const { patch } = useProjectMutations()
  const attach = (sources: ProjectSources) => patch.mutate({ id: project.id, ...sources })

  return (
    <section className="space-y-4">
      <SectionHeader title="Sources">Read by the agents and by /init to build the project context.</SectionHeader>
      <div className="divide-y rounded-lg border">
        <SourceRow
          tool="Jira"
          noun="Jira project"
          attached={project.jiraProjectKey}
          options={jiraProjects.map((item) => ({ value: item.key, label: `${item.key} · ${item.name}` }))}
          onAttach={(key, connectionId) => attach({ jiraProjectKey: key, jiraConnectionId: connectionId })}
        />
        <SourceRow
          tool="Confluence"
          noun="Space"
          attached={project.confluenceSpaceKey}
          options={spaces.map((space) => ({ value: space.key, label: `${space.key} · ${space.name}` }))}
          onAttach={(key, connectionId) => attach({ confluenceSpaceKey: key, confluenceConnectionId: connectionId })}
          signedInAs={me?.name}
        />
        <SourceRow
          tool="GitLab"
          noun="Repository"
          attached={project.gitlabProjectPath}
          options={repositories.map((repository) => ({ value: repository.path, label: repository.path }))}
          onAttach={(path, connectionId) => attach({ gitlabProjectPath: path, gitlabConnectionId: connectionId })}
        />
      </div>
    </section>
  )
}

type SourceRowProps = {
  tool: SourceTool
  noun: string
  attached?: string
  options: { value: string; label: string }[]
  // null détache la source.
  onAttach: (value: string | null, connectionId: string | null) => void
  signedInAs?: string
}

const settingsUrl = { Jira: 'jiraUrl', Confluence: 'confluenceUrl', GitLab: 'gitlabUrl' } as const

function SourceRow({ tool, noun, attached, options, onAttach, signedInAs }: SourceRowProps) {
  const [selected, setChoice] = useState<string>()
  const choice = selected ?? options[0]?.value ?? ''
  // La source est lue avec la première connexion (PAT) de l'utilisateur pour cet outil.
  const connection = useConnections(tool).data?.[0]
  const defaultUrl = useSettings().data?.[settingsUrl[tool]]
  const url = connection?.siteUrl ?? defaultUrl

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{tool}</span>
        {url && <code className="truncate font-mono text-xs text-muted-foreground">{url}</code>}
      </div>

      {attached ? (
        <div className="flex flex-wrap items-center gap-3 animate-in fade-in-0 slide-in-from-top-1">
          <CircleCheck className="size-4 text-green-600 dark:text-green-400" aria-hidden="true" />
          <span className="text-sm">{noun} attached:</span>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{attached}</code>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => onAttach(null, null)}>
            <Unlink data-icon="inline-start" />
            Detach
          </Button>
        </div>
      ) : (
        <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-1">
          {signedInAs && (
            <p className="text-xs text-muted-foreground">
              Signed in as <strong className="font-medium text-foreground">{signedInAs}</strong>
            </p>
          )}
          <Label className="text-xs">{noun} to attach</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select items={options} value={choice} onValueChange={(value) => value && setChoice(value)}>
              <SelectTrigger className="w-full sm:flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => onAttach(choice, connection?.id ?? null)} disabled={!choice}>
              <Link2 data-icon="inline-start" />
              Attach {noun.toLowerCase()}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

