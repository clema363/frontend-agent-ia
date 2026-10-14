import { useJournal, useProjects, useStories } from "@/api/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { SectionHeader, UserAvatar } from "@/components/projects/project-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  journalActionLabels,
  stages,
  type JournalEntry,
  type UserStory,
} from "@/lib/domain";
import {
  isInJournalPeriod,
  journalDay,
  journalPeriods,
} from "@/lib/journal-period";
import { Link, useSearchParams } from "@/lib/router";
import { cn } from "@/lib/utils";
import {
  Bot,
  CircleCheck,
  CircleX,
  Coins,
  Inbox,
  MessageSquare,
  RotateCcw,
  ScrollText,
  Timer,
  type LucideIcon,
} from "@lucide/vue";
import { defineComponent, ref, type VNodeChild } from "vue";
const ALL = "all";
const storyUrl = (story: UserStory) =>
  `/kanban/${encodeURIComponent(story.id)}`;
const isAgent = (entry: JournalEntry) =>
  entry.actorType === "agent" || entry.inputTokens !== undefined;
const tokensOf = (entry: JournalEntry) =>
  (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0);
const sum = (entries: JournalEntry[], value: (entry: JournalEntry) => number) =>
  entries.reduce((total, entry) => total + value(entry), 0);
const numberFormat = new Intl.NumberFormat("en");
const compactFormat = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dayFormat = new Intl.DateTimeFormat("en", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const shortDayFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
});
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
// Two shades of the primary color: input (context read by the agent) and output (generated document).
const inputColor = "color-mix(in oklch, var(--primary) 35%, transparent)";
const outputColor = "var(--primary)";
export const JournalPage = defineComponent(
  (__props: Record<string, never>) => {
    const searchParamsState0 = useSearchParams();
    // URL filters (/journal?project=p-6804&us=us-112) allow links from the Dashboard or Kanban.

    const journalState1 = useJournal();

    const now = ref((() => new Date())());
    const storiesState2 = useStories();
    const projectsState3 = useProjects();
    return () => {
      // URL filters (/journal?project=p-6804&us=us-112) allow links from the Dashboard or Kanban.
      const [searchParams, setSearchParams] = searchParamsState0;
      const filters = {
        project: searchParams.get("project") ?? ALL,
        us: searchParams.get("us") ?? ALL,
        actor: searchParams.get("actor") ?? ALL,
        action: searchParams.get("action") ?? ALL,
        period: searchParams.get("period") ?? ALL,
        from: searchParams.get("from") ?? "",
        to: searchParams.get("to") ?? "",
      };
      function setFilter(key: keyof typeof filters, value: string | null) {
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            if (!value || value === ALL) next.delete(key);
            else next.set(key, value);
            // A story from another project is no longer relevant after switching projects.
            if (key === "project") next.delete("us");
            if (key === "period" && value !== "custom") {
              next.delete("from");
              next.delete("to");
            }
            return next;
          },
          { replace: true },
        );
      }
      const { data: journal = [], isLoading, isError } = journalState1;
      const view =
        searchParams.get("view") === "analysis" ? "analysis" : "events";
      const invalidRange =
        filters.period === "custom" &&
        Boolean(filters.from && filters.to && filters.from > filters.to);
      const hasFilters = Object.values(filters).some(
        (value) => value !== ALL && value !== "",
      );
      const { data: stories = [] } = storiesState2;
      const { data: projects = [] } = projectsState3;
      const storyOf = (entry: JournalEntry) =>
        stories.find((story) => story.id === entry.usId);
      const inProject = journal.filter(
        (entry) =>
          filters.project === ALL ||
          storyOf(entry)?.projectId === filters.project,
      );
      const entries = inProject
        .filter((entry) => filters.us === ALL || entry.usId === filters.us)
        .filter(
          (entry) => filters.actor === ALL || entry.actor === filters.actor,
        )
        .filter(
          (entry) => filters.action === ALL || entry.action === filters.action,
        )
        .filter(
          (entry) =>
            !invalidRange && isInJournalPeriod(entry.at, filters, now.value),
        )
        .sort((a, b) => b.at.localeCompare(a.at));
      const unique = (values: string[]) => [...new Set(values)].sort();
      const options = {
        project: [
          { value: ALL, label: "All projects" },
          ...projects.map((project) => ({
            value: project.id,
            label: project.name,
          })),
        ],
        us: [
          { value: ALL, label: "All US" },
          ...stories
            .filter(
              (story) =>
                filters.project === ALL || story.projectId === filters.project,
            )
            .map((story) => ({
              value: story.id,
              label: `${story.key} · ${story.title}`,
            })),
        ],
        actor: [
          { value: ALL, label: "Everyone" },
          ...unique(journal.map((entry) => entry.actor)).map((actor) => ({
            value: actor,
            label: actor,
          })),
        ],
        action: [
          { value: ALL, label: "All actions" },
          ...unique(journal.map((entry) => entry.action)).map((action) => ({
            value: action,
            label: journalActionLabels[action] ?? action,
          })),
        ],
      };
      const runs = entries.filter(isAgent);
      const count = (...actions: string[]) =>
        entries.filter((entry) => actions.includes(entry.action)).length;
      return (
        <>
          <PageHeader title="Journal" icon={ScrollText} />

          <div class="mx-auto w-full max-w-6xl space-y-6">
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Filter
                label="Project"
                value={filters.project}
                options={options.project}
                onFilterChange={(value) => setFilter("project", value)}
              />
              <Filter
                label="User story"
                value={filters.us}
                options={options.us}
                onFilterChange={(value) => setFilter("us", value)}
              />
              <Filter
                label="Who"
                value={filters.actor}
                options={options.actor}
                onFilterChange={(value) => setFilter("actor", value)}
              />
              <Filter
                label="Action"
                value={filters.action}
                options={options.action}
                onFilterChange={(value) => setFilter("action", value)}
              />
            </div>

            <div class="flex flex-wrap items-end gap-3">
              <div class="w-full sm:w-48">
                <Filter
                  label="Period"
                  value={filters.period}
                  options={journalPeriods}
                  onFilterChange={(value) => setFilter("period", value)}
                />
              </div>
              {filters.period === "custom" && (
                <>
                  <div class="space-y-1.5">
                    <Label for="journal-from">From</Label>
                    <Input
                      id="journal-from"
                      type="date"
                      modelValue={filters.from}
                      max={filters.to || undefined}
                      onInput={(event) =>
                        setFilter(
                          "from",
                          (event.target as HTMLInputElement).value,
                        )
                      }
                    />
                  </div>
                  <div class="space-y-1.5">
                    <Label for="journal-to">To</Label>
                    <Input
                      id="journal-to"
                      type="date"
                      modelValue={filters.to}
                      min={filters.from || undefined}
                      onInput={(event) =>
                        setFilter(
                          "to",
                          (event.target as HTMLInputElement).value,
                        )
                      }
                    />
                  </div>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={!hasFilters}
                onClick={() =>
                  setSearchParams(
                    view === "analysis" ? { view: "analysis" } : {},
                    { replace: true },
                  )
                }
              >
                <RotateCcw data-icon="inline-start" />
                Reset filters
              </Button>
            </div>
            {invalidRange && (
              <p role="alert" class="text-sm text-destructive">
                The end date must be on or after the start date.
              </p>
            )}
            {isError && (
              <p role="alert" class="text-sm text-destructive">
                Could not load the journal. Please try again.
              </p>
            )}

            <dl
              class="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3"
              aria-busy={isLoading}
            >
              <Kpi
                icon={ScrollText}
                label="Events"
                value={isLoading ? "…" : entries.length}
                hint="in the selected period"
              />
              <Kpi
                icon={CircleCheck}
                label="Approvals"
                value={isLoading ? "…" : count("approved")}
                hint="documents validated"
              />
              <Kpi
                icon={CircleX}
                label="Changes requested"
                value={isLoading ? "…" : count("refused", "rejected")}
                hint={`${count("message")} chat messages`}
              />
            </dl>

            <Tabs
              modelValue={view}
              onUpdate:modelValue={(value) =>
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  if (value === "analysis") next.set("view", value);
                  else next.delete("view");
                  return next;
                })
              }
              class="gap-6"
            >
              <TabsList variant="line" aria-label="Journal views">
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
              </TabsList>
              <TabsContent value="events">
                <section class="space-y-4">
                  <SectionHeader title="Events" count={entries.length}>
                    Activity across the selected user stories, newest first.
                  </SectionHeader>
                  {entries.length ? (
                    <Timeline entries={entries} storyOf={storyOf} />
                  ) : (
                    <Empty icon={Inbox}>
                      {isLoading
                        ? "Loading the journal…"
                        : isError
                          ? "The journal is unavailable."
                          : "No event matches these filters."}
                    </Empty>
                  )}
                </section>
              </TabsContent>
              <TabsContent value="analysis" class="space-y-8">
                <dl class="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
                  <Kpi
                    icon={Coins}
                    label="Tokens used"
                    value={compactFormat.format(sum(runs, tokensOf))}
                    hint={`${numberFormat.format(sum(runs, (entry) => entry.outputTokens ?? 0))} generated`}
                  />
                  <Kpi
                    icon={Bot}
                    label="Agent runs"
                    value={runs.length}
                    hint={
                      runs.length
                        ? `${compactFormat.format(sum(runs, tokensOf) / runs.length)} tokens / run`
                        : "none"
                    }
                  />
                  <Kpi
                    icon={Timer}
                    label="Agent time"
                    value={seconds(sum(runs, (entry) => entry.durationMs ?? 0))}
                    hint="total generation time"
                  />
                </dl>
                <div class="grid gap-10 lg:grid-cols-2">
                  <TokensByStage runs={runs} />
                  <ActivityByDay entries={entries} />
                </div>
                <div class="grid gap-10 lg:grid-cols-2">
                  <TokensByStory runs={runs} stories={stories} />
                  <WhoDidWhat entries={entries} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </>
      );
    };
  },
  { name: "JournalPage", props: [], inheritAttrs: false },
);
type FilterProps = {
  label: string;
  value: string;
  options: {
    value: string;
    label: string;
  }[];
  onFilterChange: (value: string | null) => void;
};
const Filter = defineComponent(
  (__props: FilterProps) => {
    return () => {
      const { label, value, options, onFilterChange } = __props;
      return (
        <div class="min-w-0 space-y-1.5">
          <Label
            class="text-xs text-muted-foreground"
            for={`journal-${label.toLowerCase().replaceAll(" ", "-")}`}
          >
            {label}
          </Label>
          <Select modelValue={value} onUpdate:modelValue={onFilterChange}>
            <SelectTrigger
              id={`journal-${label.toLowerCase().replaceAll(" ", "-")}`}
              class={cn(
                "h-9 w-full",
                label === "Project" &&
                  "hover:bg-interaction-hover data-[state=open]:bg-interaction-selected",
              )}
            >
              <SelectValue class="truncate" />
            </SelectTrigger>
            <SelectContent
              class={
                label === "Project"
                  ? "[&_[role=listbox]]:flex [&_[role=listbox]]:flex-col [&_[role=listbox]]:gap-[2px] [&_[role=listbox]]:p-[2px]"
                  : undefined
              }
            >
              {options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  class={
                    label === "Project"
                      ? "focus:bg-interaction-hover data-highlighted:bg-interaction-hover data-[state=checked]:bg-interaction-selected"
                      : undefined
                  }
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    };
  },
  {
    name: "Filter",
    props: ["label", "value", "options", "onFilterChange"],
    inheritAttrs: false,
  },
);
const Kpi = defineComponent(
  (__props: {
    icon: LucideIcon;
    label: string;
    value: VNodeChild;
    hint: string;
  }) => {
    return () => {
      const { icon: Icon, label, value, hint } = __props;
      return (
        <div class="bg-background p-4">
          <dt class="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon class="size-3.5" aria-hidden="true" />
            {label}
          </dt>
          <dd class="mt-2 text-2xl font-semibold tabular-nums">{value}</dd>
          <dd class="mt-0.5 truncate text-xs text-muted-foreground">{hint}</dd>
        </div>
      );
    };
  },
  {
    name: "Kpi",
    props: ["icon", "label", "value", "hint"],
    inheritAttrs: false,
  },
);
const Legend = defineComponent(
  (__props: Record<string, never>) => {
    return () => {
      return (
        <span class="flex items-center gap-3 text-xs text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <span
              class="size-2.5 rounded-sm"
              style={{ backgroundColor: inputColor }}
              aria-hidden="true"
            />
            Input
          </span>
          <span class="flex items-center gap-1.5">
            <span
              class="size-2.5 rounded-sm"
              style={{ backgroundColor: outputColor }}
              aria-hidden="true"
            />
            Output
          </span>
        </span>
      );
    };
  },
  { name: "Legend", props: [], inheritAttrs: false },
);
const TokenBar = defineComponent(
  (
    __props: {
      input: number;
      output: number;
      max: number;
      children?: VNodeChild;
    },
    { slots },
  ) => {
    return () => {
      const { input, output, max, children } = {
        ...__props,
        children: slots.default?.(),
      };
      const width = (value: number) => `${max ? (value / max) * 100 : 0}%`;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div class="flex h-3 w-full gap-0.5 rounded-sm outline-none">
              {input > 0 && (
                <span
                  class="h-full rounded-l-sm"
                  style={{ width: width(input), backgroundColor: inputColor }}
                />
              )}
              {output > 0 && (
                <span
                  class="h-full rounded-r-sm"
                  style={{ width: width(output), backgroundColor: outputColor }}
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>{children}</TooltipContent>
        </Tooltip>
      );
    };
  },
  { name: "TokenBar", props: ["input", "output", "max"], inheritAttrs: false },
);
const TokensByStage = defineComponent(
  (__props: { runs: JournalEntry[] }) => {
    return () => {
      const { runs } = __props;
      const rows = stages.map((stage) => {
        const stageRuns = runs.filter((entry) => entry.stage === stage.id);
        return {
          stage,
          runs: stageRuns.length,
          input: sum(stageRuns, (entry) => entry.inputTokens ?? 0),
          output: sum(stageRuns, (entry) => entry.outputTokens ?? 0),
          duration: sum(stageRuns, (entry) => entry.durationMs ?? 0),
        };
      });
      const max = Math.max(0, ...rows.map((row) => row.input + row.output));
      return (
        <section class="space-y-4">
          <SectionHeader title="Tokens per step" actions={<Legend />}>
            What each agent consumed. Spec and plan read Jira, Confluence and
            GitLab.
          </SectionHeader>
          <div class="space-y-3 rounded-lg border p-4">
            {rows.map((row) => (
              <div
                key={row.stage.id}
                class="grid grid-cols-[6rem_1fr_4rem] items-center gap-3 text-sm"
              >
                <span class="truncate text-muted-foreground">
                  {row.stage.label}
                </span>
                <TokenBar input={row.input} output={row.output} max={max}>
                  {row.stage.agent} · {row.runs} run{row.runs === 1 ? "" : "s"}
                  <br />
                  {numberFormat.format(row.input)} in ·{" "}
                  {numberFormat.format(row.output)} out ·{" "}
                  {seconds(row.duration)}
                </TokenBar>
                <span class="text-right text-xs tabular-nums">
                  {compactFormat.format(row.input + row.output)}
                </span>
              </div>
            ))}
          </div>
        </section>
      );
    };
  },
  { name: "TokensByStage", props: ["runs"], inheritAttrs: false },
);
const TokensByStory = defineComponent(
  (__props: { runs: JournalEntry[]; stories: UserStory[] }) => {
    return () => {
      const { runs, stories } = __props;
      const rows = [...new Set(runs.map((entry) => entry.usId))]
        .map((usId) => {
          const storyRuns = runs.filter((entry) => entry.usId === usId);
          return {
            usId,
            story: stories.find((story) => story.id === usId),
            runs: storyRuns.length,
            input: sum(storyRuns, (entry) => entry.inputTokens ?? 0),
            output: sum(storyRuns, (entry) => entry.outputTokens ?? 0),
          };
        })
        .sort((a, b) => b.input + b.output - (a.input + a.output));
      const max = Math.max(0, ...rows.map((row) => row.input + row.output));
      return (
        <section class="space-y-4">
          <SectionHeader title="Tokens per US" actions={<Legend />}>
            Total consumption of the agents on each user story.
          </SectionHeader>
          {rows.length ? (
            <div class="space-y-3 rounded-lg border p-4">
              {rows.map((row) => (
                <div
                  key={row.usId}
                  class="grid grid-cols-[6rem_1fr_4rem] items-center gap-3 text-sm"
                >
                  {row.story ? (
                    <Link
                      to={storyUrl(row.story)}
                      class="truncate font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {row.story.key}
                    </Link>
                  ) : (
                    <span class="truncate font-mono text-xs text-muted-foreground">
                      {row.usId}
                    </span>
                  )}
                  <TokenBar input={row.input} output={row.output} max={max}>
                    {row.story?.title ?? row.usId} · {row.runs} run
                    {row.runs === 1 ? "" : "s"}
                    <br />
                    {numberFormat.format(row.input)} in ·{" "}
                    {numberFormat.format(row.output)} out
                  </TokenBar>
                  <span class="text-right text-xs tabular-nums">
                    {compactFormat.format(row.input + row.output)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={Bot}>No agent run in this selection.</Empty>
          )}
        </section>
      );
    };
  },
  { name: "TokensByStory", props: ["runs", "stories"], inheritAttrs: false },
);
const ActivityByDay = defineComponent(
  (__props: { entries: JournalEntry[] }) => {
    return () => {
      const { entries } = __props;
      const days = [
        ...new Set(entries.map((entry) => journalDay(entry.at))),
      ].sort();
      // Include every day between the first and last, even those without activity.
      const range: string[] = [];
      if (days.length) {
        for (
          let day = new Date(`${days[0]}T00:00:00Z`);
          day <= new Date(`${days.at(-1)}T00:00:00Z`);
          day.setUTCDate(day.getUTCDate() + 1)
        ) {
          range.push(day.toISOString().slice(0, 10));
        }
      }
      const columns = range.map((day) => {
        const ofDay = entries.filter((entry) => journalDay(entry.at) === day);
        const agents = ofDay.filter(isAgent).length;
        return { day, people: ofDay.length - agents, agents };
      });
      const max = Math.max(
        1,
        ...columns.map((column) => column.people + column.agents),
      );
      const height = (value: number) => `${(value / max) * 100}%`;
      return (
        <section class="space-y-4">
          <SectionHeader
            title="Activity per day"
            actions={
              <span class="flex items-center gap-3 text-xs text-muted-foreground">
                <span class="flex items-center gap-1.5">
                  <span
                    class="size-2.5 rounded-sm"
                    style={{ backgroundColor: outputColor }}
                    aria-hidden="true"
                  />
                  People
                </span>
                <span class="flex items-center gap-1.5">
                  <span
                    class="size-2.5 rounded-sm"
                    style={{ backgroundColor: inputColor }}
                    aria-hidden="true"
                  />
                  Agents
                </span>
              </span>
            }
          >
            Events recorded each day.
          </SectionHeader>
          {columns.length ? (
            <div class="rounded-lg border p-4">
              <div class="flex h-40 items-end gap-1 border-b">
                {columns.map((column) => (
                  <Tooltip key={column.day}>
                    <TooltipTrigger asChild>
                      <div class="flex h-full min-w-0 flex-1 flex-col justify-end gap-0.5 outline-none">
                        {column.agents > 0 && (
                          <span
                            class="rounded-t-sm"
                            style={{
                              height: height(column.agents),
                              backgroundColor: inputColor,
                            }}
                          />
                        )}
                        {column.people > 0 && (
                          <span
                            class={cn(column.agents === 0 && "rounded-t-sm")}
                            style={{
                              height: height(column.people),
                              backgroundColor: outputColor,
                            }}
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {dayFormat.format(new Date(`${column.day}T12:00:00`))} ·{" "}
                      {column.people} by people, {column.agents} by agents
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <div class="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>
                  {shortDayFormat.format(new Date(`${range[0]}T12:00:00`))}
                </span>
                <span>
                  {shortDayFormat.format(new Date(`${range.at(-1)!}T12:00:00`))}
                </span>
              </div>
            </div>
          ) : (
            <Empty icon={Inbox}>No activity in this selection.</Empty>
          )}
        </section>
      );
    };
  },
  { name: "ActivityByDay", props: ["entries"], inheritAttrs: false },
);
const actionColumns = [
  { label: "Created", actions: ["created"] },
  { label: "Approved", actions: ["approved"] },
  { label: "Changes", actions: ["refused", "rejected"] },
  { label: "Messages", actions: ["message"] },
  { label: "Edits", actions: ["edited"] },
];
const WhoDidWhat = defineComponent(
  (__props: { entries: JournalEntry[] }) => {
    return () => {
      const { entries } = __props;
      const actors = [...new Set(entries.map((entry) => entry.actor))];
      const people = actors
        .filter(
          (actor) =>
            !entries.some((entry) => entry.actor === actor && isAgent(entry)),
        )
        .sort();
      const agents = stages
        .map((stage) => stage.agent)
        .filter((agent) => actors.includes(agent));
      return (
        <section class="space-y-4">
          <SectionHeader title="Who did what">
            Actions of each person and runs of each agent.
          </SectionHeader>
          {actors.length ? (
            <div class="overflow-x-auto rounded-lg border">
              <table class="w-full text-sm">
                <thead class="border-b text-xs text-muted-foreground">
                  <tr>
                    <th class="px-4 py-2 text-left font-normal">Person</th>
                    {actionColumns.map((column) => (
                      <th
                        key={column.label}
                        class="px-2 py-2 text-right font-normal"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody class="divide-y">
                  {people.map((actor) => {
                    const own = entries.filter(
                      (entry) => entry.actor === actor,
                    );
                    return (
                      <tr key={actor}>
                        <td class="px-4 py-2">
                          <span class="flex items-center gap-2">
                            <UserAvatar
                              name={actor}
                              className="size-6 text-[10px]"
                            />
                            <span class="truncate">{actor}</span>
                          </span>
                        </td>
                        {actionColumns.map((column) => {
                          const value = own.filter((entry) =>
                            column.actions.includes(entry.action),
                          ).length;
                          return (
                            <td
                              key={column.label}
                              class={cn(
                                "px-2 py-2 text-right tabular-nums",
                                !value && "text-muted-foreground/50",
                              )}
                            >
                              {value || "–"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {agents.length > 0 && (
                <table class="w-full border-t text-sm">
                  <thead class="border-b text-xs text-muted-foreground">
                    <tr>
                      <th class="px-4 py-2 text-left font-normal">Agent</th>
                      <th class="px-2 py-2 text-right font-normal">Runs</th>
                      <th class="px-2 py-2 text-right font-normal">Tokens</th>
                      <th class="px-4 py-2 text-right font-normal">Avg time</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    {agents.map((agent) => {
                      const own = entries.filter(
                        (entry) => entry.actor === agent,
                      );
                      return (
                        <tr key={agent}>
                          <td class="px-4 py-2">
                            <span class="flex items-center gap-2">
                              <span class="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Bot class="size-3.5" aria-hidden="true" />
                              </span>
                              {agent}
                            </span>
                          </td>
                          <td class="px-2 py-2 text-right tabular-nums">
                            {own.length}
                          </td>
                          <td class="px-2 py-2 text-right tabular-nums">
                            {numberFormat.format(sum(own, tokensOf))}
                          </td>
                          <td class="px-4 py-2 text-right tabular-nums">
                            {seconds(
                              sum(own, (entry) => entry.durationMs ?? 0) /
                                own.length,
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <Empty icon={Inbox}>Nobody did anything in this selection.</Empty>
          )}
        </section>
      );
    };
  },
  { name: "WhoDidWhat", props: ["entries"], inheritAttrs: false },
);
const actionIcons: Record<string, LucideIcon> = {
  approved: CircleCheck,
  refused: CircleX,
  rejected: CircleX,
  message: MessageSquare,
};
const Timeline = defineComponent(
  (__props: {
    entries: JournalEntry[];
    storyOf: (entry: JournalEntry) => UserStory | undefined;
  }) => {
    return () => {
      const { entries, storyOf } = __props;
      const days = [...new Set(entries.map((entry) => journalDay(entry.at)))];
      return (
        <div class="space-y-6">
          {days.map((day) => (
            <div key={day} class="space-y-2">
              <h3 class="text-xs font-medium text-muted-foreground">
                {dayFormat.format(new Date(`${day}T12:00:00`))}
              </h3>
              <ol class="divide-y rounded-lg border text-sm">
                {entries
                  .filter((entry) => journalDay(entry.at) === day)
                  .map((entry) => (
                    <TimelineRow
                      key={entry.id}
                      entry={entry}
                      story={storyOf(entry)}
                    />
                  ))}
              </ol>
            </div>
          ))}
        </div>
      );
    };
  },
  { name: "Timeline", props: ["entries", "storyOf"], inheritAttrs: false },
);
const TimelineRow = defineComponent(
  (__props: { entry: JournalEntry; story?: UserStory }) => {
    return () => {
      const { entry, story } = __props;
      const stage = stages.find((item) => item.id === entry.stage);
      const agent = isAgent(entry);
      const Icon = actionIcons[entry.action];
      return (
        <li class="flex items-start gap-3 px-4 py-2.5">
          {agent ? (
            <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot class="size-4" aria-hidden="true" />
            </span>
          ) : (
            <UserAvatar name={entry.actor} className="size-7 text-[10px]" />
          )}
          <div class="min-w-0 flex-1">
            <p class="flex flex-wrap items-center gap-x-1.5">
              <span class="font-medium">{entry.actor}</span>
              {Icon && (
                <Icon
                  class={cn(
                    "size-3.5",
                    entry.action === "approved"
                      ? "text-green-600 dark:text-green-400"
                      : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
              )}
              <span class="text-muted-foreground">
                {journalActionLabels[entry.action] ?? entry.action}
              </span>
              {story ? (
                <Link
                  to={storyUrl(story)}
                  class="font-mono text-xs hover:underline"
                >
                  {story.key}
                </Link>
              ) : (
                <span class="font-mono text-xs">{entry.usId}</span>
              )}
              {stage && (
                <span class="rounded border px-1.5 py-px text-[11px] leading-4 text-muted-foreground">
                  {stage.label}
                </span>
              )}
            </p>
            {story && (
              <p class="truncate text-xs text-muted-foreground">
                {story.title}
              </p>
            )}
            {entry.detail && (
              <p class="mt-1 text-xs text-muted-foreground italic">
                {entry.detail}
              </p>
            )}
            {agent && entry.inputTokens !== undefined && (
              <p class="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
                <span>{numberFormat.format(entry.inputTokens)} in</span>
                <span>{numberFormat.format(entry.outputTokens ?? 0)} out</span>
                {entry.durationMs !== undefined && (
                  <span>{seconds(entry.durationMs)}</span>
                )}
                {entry.model && <span class="font-mono">{entry.model}</span>}
              </p>
            )}
          </div>
          <time
            datetime={entry.at}
            class="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {timeFormat.format(new Date(entry.at))}
          </time>
        </li>
      );
    };
  },
  { name: "TimelineRow", props: ["entry", "story"], inheritAttrs: false },
);
const Empty = defineComponent(
  (
    __props: {
      icon: LucideIcon;
      children?: VNodeChild;
    },
    { slots },
  ) => {
    return () => {
      const { icon: Icon, children } = {
        ...__props,
        children: slots.default?.(),
      };
      return (
        <p class="flex items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          <Icon class="size-4" aria-hidden="true" />
          {children}
        </p>
      );
    };
  },
  { name: "Empty", props: ["icon"], inheritAttrs: false },
);
