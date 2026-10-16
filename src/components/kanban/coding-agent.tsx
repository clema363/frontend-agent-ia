import {
  Bot,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CodingAgentRun, CodingAgentStatus } from '@/lib/domain'
import { cn } from '@/lib/utils'

// Coding agent status and merge request, presented like Linear: the agent is a teammate
// with a status and, eventually, a merge request. Its session is shown by OpencodeSession.

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

function StatusPill({ status }: { status: CodingAgentStatus }) {
  const { label, icon: Icon, className, live } = statusStyles[status]
  return (
    <span className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', className)}>
      <Icon className={cn('size-3.5', status === 'working' && 'animate-spin')} aria-hidden="true" />
      <span className={cn(live && 'animate-pulse')}>{label}</span>
    </span>
  )
}

const ciStyles = {
  pending: { label: 'Pipeline running', className: 'text-amber-600 dark:text-amber-400' },
  passed: { label: 'Pipeline passed', className: 'text-green-600 dark:text-green-400' },
  failed: { label: 'Pipeline failed', className: 'text-red-600 dark:text-red-400' },
}

// GitLab merge request opened by OpenCode, shown in the story sidebar next to the session.
export function MergeRequest({ run }: { run: CodingAgentRun }) {
  const mr = run.pullRequest

  return (
    <div className="space-y-3 rounded-lg border p-3 text-sm">
      <div className="flex items-center gap-2">
        <GitPullRequest className="size-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
        <span className="font-medium">{mr ? `!${mr.number}` : 'No merge request yet'}</span>
        <span className="ml-auto">
          <StatusPill status={run.status} />
        </span>
      </div>
      {run.branch && (
        <p className="flex items-center gap-1 truncate font-mono text-xs text-muted-foreground" title={run.branch}>
          <GitBranch className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{run.branch}</span>
        </p>
      )}
      {mr && (
        <>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className={cn('flex items-center gap-1', ciStyles[mr.ci].className)}>
              {mr.ci === 'pending' ? (
                <Loader className="size-3.5 animate-spin" aria-hidden="true" />
              ) : mr.ci === 'passed' ? (
                <CircleCheck className="size-3.5" aria-hidden="true" />
              ) : (
                <CircleAlert className="size-3.5" aria-hidden="true" />
              )}
              {ciStyles[mr.ci].label}
            </span>
            <span className="font-mono tabular-nums">
              <span className="text-green-600 dark:text-green-400">+{mr.additions}</span>{' '}
              <span className="text-red-600 dark:text-red-400">−{mr.deletions}</span>
            </span>
          </div>
          <Button variant="outline" size="sm" className="w-full" nativeButton={false} render={<a href={mr.url} target="_blank" rel="noreferrer" />}>
            <ExternalLink data-icon="inline-start" />
            Open in GitLab
          </Button>
        </>
      )}
    </div>
  )
}
