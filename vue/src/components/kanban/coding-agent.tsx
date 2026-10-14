import { Button } from "@/components/ui/button";
import type {
  CodingAgentActivity,
  CodingAgentRun,
  CodingAgentStatus,
} from "@/lib/domain";
import { cn, timeAgo } from "@/lib/utils";
import {
  Bot,
  Brain,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader,
  Wrench,
  type LucideIcon,
} from "@lucide/vue";
import { defineComponent } from "vue";
// Coding agent session, presented like Linear: the agent is a teammate
// with a status, a stream of published activities and, eventually, a merge request.
const statusStyles: Record<
  CodingAgentStatus,
  {
    label: string;
    icon: LucideIcon;
    className: string;
    live?: boolean;
  }
> = {
  queued: {
    label: "Queued",
    icon: CircleDashed,
    className: "text-muted-foreground",
  },
  working: {
    label: "Working",
    icon: Loader,
    className: "text-primary",
    live: true,
  },
  "needs-input": {
    label: "Needs input",
    icon: CircleHelp,
    className: "text-amber-600 dark:text-amber-400",
    live: true,
  },
  "pr-opened": {
    label: "MR opened",
    icon: GitPullRequest,
    className: "text-green-600 dark:text-green-400",
  },
  merged: {
    label: "Merged",
    icon: GitMerge,
    className: "text-violet-600 dark:text-violet-400",
  },
  failed: {
    label: "Failed",
    icon: CircleAlert,
    className: "text-red-600 dark:text-red-400",
  },
};
export const AgentAvatar = defineComponent(
  (__props: { className?: string }) => {
    return () => {
      const { className } = __props;
      return (
        <span
          class={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
            className,
          )}
          aria-hidden="true"
        >
          <Bot class="size-3" />
        </span>
      );
    };
  },
  { name: "AgentAvatar", props: ["className"], inheritAttrs: false },
);
export const CodingAgentChip = defineComponent(
  (__props: { run: CodingAgentRun }) => {
    return () => {
      const { run } = __props;
      const style = statusStyles[run.status];
      return (
        <span
          class={cn("flex items-center gap-1.5 text-xs", style.className)}
          title={`${run.agent} · ${style.label}`}
        >
          <span class="relative">
            <AgentAvatar />
            {style.live && (
              <span class="absolute -right-0.5 -bottom-0.5 flex size-2">
                <span class="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
                <span class="relative inline-flex size-2 rounded-full border border-background bg-current" />
              </span>
            )}
          </span>
          {run.pullRequest ? `!${run.pullRequest.number}` : style.label}
        </span>
      );
    };
  },
  { name: "CodingAgentChip", props: ["run"], inheritAttrs: false },
);
const duration = (ms: number) => {
  const minutes = Math.round(ms / 60000);
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};
const numberFormat = new Intl.NumberFormat("en");
export const CodingAgentPanel = defineComponent(
  (__props: { run?: CodingAgentRun }) => {
    return () => {
      const { run } = __props;
      if (!run) {
        return (
          <p class="flex items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-muted-foreground">
            The coding agent starts once the plan is approved.
          </p>
        );
      }
      const style = statusStyles[run.status];
      return (
        <div class="space-y-5">
          <section class="flex items-center gap-3 rounded-lg border p-3">
            <AgentAvatar className="size-9 [&_svg]:size-4.5" />
            <div class="min-w-0 flex-1">
              <p class="font-medium">{run.agent}</p>
              <p class="text-xs text-muted-foreground">
                Started {timeAgo(run.startedAt)}
                {run.durationMs !== undefined &&
                  ` · ${duration(run.durationMs)}`}
                {run.inputTokens !== undefined &&
                  ` · ${numberFormat.format(run.inputTokens + (run.outputTokens ?? 0))} tokens`}
              </p>
            </div>
            <StatusPill status={run.status} />
          </section>

          <section class="space-y-2">
            <h3 class="text-xs font-medium text-muted-foreground">Activity</h3>
            {run.activities.length ? (
              <ol class="relative space-y-3 pl-7 before:absolute before:inset-y-2 before:left-2.5 before:w-px before:bg-border">
                {run.activities.map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} />
                ))}
                {style.live && (
                  <li class="relative flex items-center gap-2 text-xs text-muted-foreground">
                    <span class="absolute -left-7 flex size-5 items-center justify-center rounded-full bg-background">
                      <Loader
                        class="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    </span>
                    <span class="animate-pulse">
                      {run.status === "needs-input"
                        ? "Waiting for an answer…"
                        : "Working…"}
                    </span>
                  </li>
                )}
              </ol>
            ) : (
              <p class="flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                <CircleDashed class="size-4" aria-hidden="true" />
                Waiting for the agent to pick up the plan.
              </p>
            )}
          </section>

          {(run.branch || run.pullRequest) && <MergeRequest run={run} />}
        </div>
      );
    };
  },
  { name: "CodingAgentPanel", props: ["run"], inheritAttrs: false },
);
const StatusPill = defineComponent(
  (__props: { status: CodingAgentStatus }) => {
    return () => {
      const { status } = __props;
      const { label, icon: Icon, className, live } = statusStyles[status];
      return (
        <span
          class={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
            className,
          )}
        >
          <Icon
            class={cn("size-3.5", status === "working" && "animate-spin")}
            aria-hidden="true"
          />
          <span class={cn(live && "animate-pulse")}>{label}</span>
        </span>
      );
    };
  },
  { name: "StatusPill", props: ["status"], inheritAttrs: false },
);
const activityStyles: Record<
  CodingAgentActivity["kind"],
  {
    icon: LucideIcon;
    className: string;
  }
> = {
  thought: { icon: Brain, className: "text-muted-foreground" },
  action: { icon: Wrench, className: "text-foreground" },
  question: {
    icon: CircleHelp,
    className: "text-amber-600 dark:text-amber-400",
  },
  response: {
    icon: CircleCheck,
    className: "text-green-600 dark:text-green-400",
  },
  error: { icon: CircleAlert, className: "text-red-600 dark:text-red-400" },
};
const ActivityRow = defineComponent(
  (__props: { activity: CodingAgentActivity }) => {
    return () => {
      const { activity } = __props;
      const { icon: Icon, className } = activityStyles[activity.kind];
      const highlighted =
        activity.kind === "question" || activity.kind === "response";
      return (
        <li class="relative">
          <span
            class={cn(
              "absolute -left-7 flex size-5 items-center justify-center rounded-full bg-background",
              className,
            )}
          >
            <Icon class="size-3.5" aria-hidden="true" />
          </span>
          <div
            class={cn(
              "text-sm",
              activity.kind === "thought" && "text-muted-foreground italic",
              highlighted && "rounded-lg border px-3 py-2",
              activity.kind === "question" &&
                "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
            )}
          >
            <p class="flex flex-wrap items-baseline gap-x-2">
              <span>{activity.text}</span>
              {activity.file && (
                <code class="rounded bg-muted px-1.5 py-px font-mono text-xs not-italic">
                  {activity.file}
                </code>
              )}
              <time
                datetime={activity.at}
                class="ml-auto text-xs text-muted-foreground not-italic"
              >
                {timeAgo(activity.at)}
              </time>
            </p>
          </div>
        </li>
      );
    };
  },
  { name: "ActivityRow", props: ["activity"], inheritAttrs: false },
);
const ciStyles = {
  pending: {
    label: "Pipeline running",
    className: "text-amber-600 dark:text-amber-400",
  },
  passed: {
    label: "Pipeline passed",
    className: "text-green-600 dark:text-green-400",
  },
  failed: {
    label: "Pipeline failed",
    className: "text-red-600 dark:text-red-400",
  },
};
const MergeRequest = defineComponent(
  (__props: { run: CodingAgentRun }) => {
    return () => {
      const { run } = __props;
      const mr = run.pullRequest;
      return (
        <section class="space-y-2">
          <h3 class="text-xs font-medium text-muted-foreground">
            Merge request
          </h3>
          <div class="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <GitPullRequest
              class="size-4 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1 space-y-0.5">
              {mr && <p class="font-medium">!{mr.number}</p>}
              {run.branch && (
                <p class="flex items-center gap-1 truncate font-mono text-xs text-muted-foreground">
                  <GitBranch class="size-3 shrink-0" aria-hidden="true" />
                  {run.branch}
                </p>
              )}
            </div>
            {mr && (
              <>
                <span class="font-mono text-xs tabular-nums">
                  <span class="text-green-600 dark:text-green-400">
                    +{mr.additions}
                  </span>{" "}
                  <span class="text-red-600 dark:text-red-400">
                    −{mr.deletions}
                  </span>
                </span>
                <span
                  class={cn(
                    "flex items-center gap-1 text-xs",
                    ciStyles[mr.ci].className,
                  )}
                >
                  {mr.ci === "pending" ? (
                    <Loader class="size-3.5 animate-spin" aria-hidden="true" />
                  ) : mr.ci === "passed" ? (
                    <CircleCheck class="size-3.5" aria-hidden="true" />
                  ) : (
                    <CircleAlert class="size-3.5" aria-hidden="true" />
                  )}
                  {ciStyles[mr.ci].label}
                </span>
                <Button variant="outline" size="sm" asChild>
                  <a href={mr.url} target="_blank" rel="noreferrer">
                    <ExternalLink data-icon="inline-start" />
                    Open in GitLab
                  </a>
                </Button>
              </>
            )}
          </div>
        </section>
      );
    };
  },
  { name: "MergeRequest", props: ["run"], inheritAttrs: false },
);
