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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CodingAgentActivity, CodingAgentRun, CodingAgentStatus } from '@/lib/domain'
import { cn, timeAgo } from '@/lib/utils'

// Coding agent session, presented like Linear: the agent is a teammate
// with a status, a stream of published activities and, eventually, a merge request.

const statusStyles: Record<CodingAgentStatus, { label: string; icon: LucideIcon; className: string; live?: boolean }> = {
  queued: { label: 'Queued', icon: CircleDashed, className: 'text-muted-foreground' },
  working: { label: 'Working', icon: Loader, className: 'text-primary', live: true },
  'needs-input': { label: 'Needs input', icon: CircleHelp, className: 'text-amber-600 dark:text-amber-400', live: true },
  'pr-opened': { label: 'MR opened', icon: GitPullRequest, className: 'text-green-600 dark:text-green-400' },
  merged: { label: 'Merged', icon: GitMerge, className: 'text-violet-600 dark:text-violet-400' },
  failed: { label: 'Failed', icon: CircleAlert, className: 'text-red-600 dark:text-red-400' },
}

export function AgentAvatar({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary', className)} aria-hidden="true">
      <Bot className="size-3" />
    </span>
  )
}

// Compact card/list view: agent avatar, animated dot while working and MR number.
export function CodingAgentChip({ run }: { run: CodingAgentRun }) {
  const style = statusStyles[run.status]
  return (
    <span className={cn('flex items-center gap-1.5 text-xs', style.className)} title={`${run.agent} · ${style.label}`}>
      <span className="relative">
        <AgentAvatar />
        {style.live && (
          <span className="absolute -right-0.5 -bottom-0.5 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
            <span className="relative inline-flex size-2 rounded-full border border-background bg-current" />
          </span>
        )}
      </span>
      {run.pullRequest ? `!${run.pullRequest.number}` : style.label}
    </span>
  )
}

const duration = (ms: number) => {
  const minutes = Math.round(ms / 60_000)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}
const numberFormat = new Intl.NumberFormat('en')

export function CodingAgentPanel({ run }: { run?: CodingAgentRun }) {
  if (!run) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-muted-foreground">
        The coding agent starts once the plan is approved.
      </p>
    )
  }

  const style = statusStyles[run.status]

  return (
    <div className="space-y-5">
      <section className="flex items-center gap-3 rounded-lg border p-3">
        <AgentAvatar className="size-9 [&_svg]:size-4.5" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{run.agent}</p>
          <p className="text-xs text-muted-foreground">
            Started {timeAgo(run.startedAt)}
            {run.durationMs !== undefined && ` · ${duration(run.durationMs)}`}
            {run.inputTokens !== undefined && ` · ${numberFormat.format(run.inputTokens + (run.outputTokens ?? 0))} tokens`}
          </p>
        </div>
        <StatusPill status={run.status} />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">Activity</h3>
        {run.activities.length ? (
          <ol className="relative space-y-3 pl-7 before:absolute before:inset-y-2 before:left-2.5 before:w-px before:bg-border">
            {run.activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
            {style.live && (
              <li className="relative flex items-center gap-2 text-xs text-muted-foreground">
                <span className="absolute -left-7 flex size-5 items-center justify-center rounded-full bg-background">
                  <Loader className="size-3.5 animate-spin" aria-hidden="true" />
                </span>
                <span className="animate-pulse">{run.status === 'needs-input' ? 'Waiting for an answer…' : 'Working…'}</span>
              </li>
            )}
          </ol>
        ) : (
          <p className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            <CircleDashed className="size-4" aria-hidden="true" />
            Waiting for the agent to pick up the plan.
          </p>
        )}
      </section>

      {(run.branch || run.pullRequest) && <MergeRequest run={run} />}
    </div>
  )
}

function StatusPill({ status }: { status: CodingAgentStatus }) {
  const { label, icon: Icon, className, live } = statusStyles[status]
  return (
    <span className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', className)}>
      <Icon className={cn('size-3.5', status === 'working' && 'animate-spin')} aria-hidden="true" />
      <span className={cn(live && 'animate-pulse')}>{label}</span>
    </span>
  )
}

const activityStyles: Record<CodingAgentActivity['kind'], { icon: LucideIcon; className: string }> = {
  thought: { icon: Brain, className: 'text-muted-foreground' },
  action: { icon: Wrench, className: 'text-foreground' },
  question: { icon: CircleHelp, className: 'text-amber-600 dark:text-amber-400' },
  response: { icon: CircleCheck, className: 'text-green-600 dark:text-green-400' },
  error: { icon: CircleAlert, className: 'text-red-600 dark:text-red-400' },
}

function ActivityRow({ activity }: { activity: CodingAgentActivity }) {
  const { icon: Icon, className } = activityStyles[activity.kind]
  const highlighted = activity.kind === 'question' || activity.kind === 'response'

  return (
    <li className="relative">
      <span className={cn('absolute -left-7 flex size-5 items-center justify-center rounded-full bg-background', className)}>
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div
        className={cn(
          'text-sm',
          activity.kind === 'thought' && 'text-muted-foreground italic',
          highlighted && 'rounded-lg border px-3 py-2',
          activity.kind === 'question' && 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
        )}
      >
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span>{activity.text}</span>
          {activity.file && <code className="rounded bg-muted px-1.5 py-px font-mono text-xs not-italic">{activity.file}</code>}
          <time dateTime={activity.at} className="ml-auto text-xs text-muted-foreground not-italic">
            {timeAgo(activity.at)}
          </time>
        </p>
      </div>
    </li>
  )
}

const ciStyles = {
  pending: { label: 'Pipeline running', className: 'text-amber-600 dark:text-amber-400' },
  passed: { label: 'Pipeline passed', className: 'text-green-600 dark:text-green-400' },
  failed: { label: 'Pipeline failed', className: 'text-red-600 dark:text-red-400' },
}

function MergeRequest({ run }: { run: CodingAgentRun }) {
  const mr = run.pullRequest

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">Merge request</h3>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <GitPullRequest className="size-4 text-green-600 dark:text-green-400" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-0.5">
          {mr && <p className="font-medium">!{mr.number}</p>}
          {run.branch && (
            <p className="flex items-center gap-1 truncate font-mono text-xs text-muted-foreground">
              <GitBranch className="size-3 shrink-0" aria-hidden="true" />
              {run.branch}
            </p>
          )}
        </div>
        {mr && (
          <>
            <span className="font-mono text-xs tabular-nums">
              <span className="text-green-600 dark:text-green-400">+{mr.additions}</span>{' '}
              <span className="text-red-600 dark:text-red-400">−{mr.deletions}</span>
            </span>
            <span className={cn('flex items-center gap-1 text-xs', ciStyles[mr.ci].className)}>
              {mr.ci === 'pending' ? (
                <Loader className="size-3.5 animate-spin" aria-hidden="true" />
              ) : mr.ci === 'passed' ? (
                <CircleCheck className="size-3.5" aria-hidden="true" />
              ) : (
                <CircleAlert className="size-3.5" aria-hidden="true" />
              )}
              {ciStyles[mr.ci].label}
            </span>
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={mr.url} target="_blank" rel="noreferrer" />}>
              <ExternalLink data-icon="inline-start" />
              Open in GitLab
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
