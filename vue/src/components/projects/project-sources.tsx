import {
  useConfluenceSpaces,
  useConnections,
  useGitlabProjects,
  useJiraProjects,
  useMe,
  useProjectMutations,
  useSettings,
} from "@/api/hooks";
import { SectionHeader } from "@/components/projects/project-parts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project, ProjectSources, SourceTool } from "@/lib/domain";
import { CircleCheck, Link2, Unlink } from "@lucide/vue";
import { defineComponent, ref } from "vue";
export const SourcesSection = defineComponent(
  (__props: { project: Project }) => {
    const meState0 = useMe();
    const jiraProjectsState1 = useJiraProjects(() => true);
    const confluenceSpacesState2 = useConfluenceSpaces(() => true);
    const gitlabProjectsState3 = useGitlabProjects(() => true);
    const projectMutationsState4 = useProjectMutations();
    return () => {
      const { project } = __props;
      const { data: me } = meState0;
      const { data: jiraProjects = [] } = jiraProjectsState1;
      const { data: spaces = [] } = confluenceSpacesState2;
      const { data: repositories = [] } = gitlabProjectsState3;
      const { patch } = projectMutationsState4;
      const attach = (sources: ProjectSources) =>
        patch.trigger({ id: project.id, ...sources });
      return (
        <section class="space-y-4">
          <SectionHeader title="Sources">
            Read by the agents and by /init to build the project context.
          </SectionHeader>
          <div class="divide-y rounded-lg border">
            <SourceRow
              tool="Jira"
              noun="Jira project"
              attached={project.jiraProjectKey}
              options={jiraProjects.map((item) => ({
                value: item.key,
                label: `${item.key} · ${item.name}`,
              }))}
              onAttach={(key, connectionId) =>
                attach({ jiraProjectKey: key, jiraConnectionId: connectionId })
              }
            />
            <SourceRow
              tool="Confluence"
              noun="Space"
              attached={project.confluenceSpaceKey}
              options={spaces.map((space) => ({
                value: space.key,
                label: `${space.key} · ${space.name}`,
              }))}
              onAttach={(key, connectionId) =>
                attach({
                  confluenceSpaceKey: key,
                  confluenceConnectionId: connectionId,
                })
              }
              signedInAs={me?.name}
            />
            <SourceRow
              tool="GitLab"
              noun="Repository"
              attached={project.gitlabProjectPath}
              options={repositories.map((repository) => ({
                value: repository.path,
                label: repository.path,
              }))}
              onAttach={(path, connectionId) =>
                attach({
                  gitlabProjectPath: path,
                  gitlabConnectionId: connectionId,
                })
              }
            />
          </div>
        </section>
      );
    };
  },
  { name: "SourcesSection", props: ["project"], inheritAttrs: false },
);
type SourceRowProps = {
  tool: SourceTool;
  noun: string;
  attached?: string;
  options: {
    value: string;
    label: string;
  }[];
  // null detaches the source.
  onAttach: (value: string | null, connectionId: string | null) => void;
  signedInAs?: string;
};
const settingsUrl = {
  Jira: "jiraUrl",
  Confluence: "confluenceUrl",
  GitLab: "gitlabUrl",
} as const;
const SourceRow = defineComponent(
  (__props: SourceRowProps) => {
    const { tool } = __props;
    const selected = ref<string | undefined>(undefined);
    const setChoice = (
      next:
        | string
        | undefined
        | ((current: string | undefined) => string | undefined),
    ) => {
      selected.value =
        typeof next === "function"
          ? (next as (current: typeof selected.value) => typeof selected.value)(
              selected.value,
            )
          : next;
    };
    const connectionsState5 = useConnections(() => tool);
    const settingsState6 = useSettings();
    return () => {
      const { tool, noun, attached, options, onAttach, signedInAs } = __props;
      const choice = selected.value ?? options[0]?.value ?? "";
      // Read the source using the user's first connection (PAT) for this tool.
      const connection = connectionsState5.data?.[0];
      const defaultUrl = settingsState6.data?.[settingsUrl[tool]];
      const url = connection?.siteUrl ?? defaultUrl;
      return (
        <div class="space-y-3 px-4 py-4">
          <div class="flex items-center justify-between gap-3">
            <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {tool}
            </span>
            {url && (
              <code class="truncate font-mono text-xs text-muted-foreground">
                {url}
              </code>
            )}
          </div>

          {attached ? (
            <div class="flex flex-wrap items-center gap-3 animate-in fade-in-0 slide-in-from-top-1">
              <CircleCheck
                class="size-4 text-green-600 dark:text-green-400"
                aria-hidden="true"
              />
              <span class="text-sm">{noun} attached:</span>
              <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {attached}
              </code>
              <Button
                variant="outline"
                size="sm"
                class="ml-auto"
                onClick={() => onAttach(null, null)}
              >
                <Unlink data-icon="inline-start" />
                Detach
              </Button>
            </div>
          ) : (
            <div class="space-y-2 animate-in fade-in-0 slide-in-from-top-1">
              {signedInAs && (
                <p class="text-xs text-muted-foreground">
                  Signed in as{" "}
                  <strong class="font-medium text-foreground">
                    {signedInAs}
                  </strong>
                </p>
              )}
              <Label class="text-xs">{noun} to attach</Label>
              <div class="flex flex-col gap-2 sm:flex-row">
                <Select
                  modelValue={choice}
                  onUpdate:modelValue={(value) => value && setChoice(value)}
                >
                  <SelectTrigger class="w-full sm:flex-1">
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
                <Button
                  onClick={() => onAttach(choice, connection?.id ?? null)}
                  disabled={!choice}
                >
                  <Link2 data-icon="inline-start" />
                  Attach {noun.toLowerCase()}
                </Button>
              </div>
            </div>
          )}
        </div>
      );
    };
  },
  {
    name: "SourceRow",
    props: ["tool", "noun", "attached", "options", "onAttach", "signedInAs"],
    inheritAttrs: false,
  },
);
