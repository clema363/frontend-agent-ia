import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Source, SourceTool } from '@/lib/domain'

const toolStyles: Record<SourceTool, string> = {
  Jira: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  Confluence: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  GitLab: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
}

type SourceBadgeProps = {
  tool: SourceTool
  label?: string
}

export function SourceBadge({ tool, label }: SourceBadgeProps) {
  return (
    <Badge variant="secondary" className={cn(toolStyles[tool], 'max-w-full')} title={label ? `${tool} · ${label}` : tool}>
      <span className="font-semibold">{tool}</span>
      {label && <span className="truncate font-normal opacity-80">{label}</span>}
    </Badge>
  )
}

export function SourceList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((source) => (
        <SourceBadge key={`${source.tool}-${source.label}`} tool={source.tool} label={source.label} />
      ))}
    </div>
  )
}
