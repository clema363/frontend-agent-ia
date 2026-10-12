import { ArrowDown, ArrowUp, Bookmark, Bug, Equal, FlaskConical, SquareCheck, Zap, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { kanbanColumns, type IssueType, type KanbanColumnId, type Priority } from '@/lib/domain'

const typeStyles: Record<IssueType, { icon: LucideIcon; className: string }> = {
  Story: { icon: Bookmark, className: 'text-green-600 dark:text-green-400' },
  Epic: { icon: Zap, className: 'text-violet-600 dark:text-violet-400' },
  Bug: { icon: Bug, className: 'text-red-600 dark:text-red-400' },
  Task: { icon: SquareCheck, className: 'text-blue-600 dark:text-blue-400' },
  Spike: { icon: FlaskConical, className: 'text-amber-600 dark:text-amber-400' },
}

const priorityStyles: Record<Priority, { icon: LucideIcon; className: string }> = {
  High: { icon: ArrowUp, className: 'text-red-600 dark:text-red-400' },
  Medium: { icon: Equal, className: 'text-amber-600 dark:text-amber-400' },
  Low: { icon: ArrowDown, className: 'text-blue-600 dark:text-blue-400' },
}

export function IssueTypeIcon({ type, className }: { type: IssueType; className?: string }) {
  const { icon: Icon, className: color } = typeStyles[type]
  return <Icon className={cn('size-3.5 shrink-0', color, className)} aria-label={type} />
}

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const { icon: Icon, className: color } = priorityStyles[priority]
  return <Icon className={cn('size-3.5 shrink-0', color, className)} aria-label={`${priority} priority`} />
}

// Icône d'état d'une colonne, comme les statuts de Linear : un cercle qui se remplit d'étape en étape,
// puis une coche quand la US est partie chez l'IA de développement.
export function ColumnIcon({ column, className }: { column: KanbanColumnId; className?: string }) {
  const index = kanbanColumns.findIndex((item) => item.id === column)
  const { color, title } = kanbanColumns[index]
  const share = index / (kanbanColumns.length - 1)
  const last = index === kanbanColumns.length - 1
  // Part remplie dessinée comme un arc épais : le cercle intérieur a un rayon de 2, sa circonférence vaut 4π.
  const circumference = 4 * Math.PI

  return (
    <svg viewBox="0 0 14 14" className={cn('size-3.5 shrink-0', className)} style={{ color }} role="img" aria-label={title}>
      <circle cx="7" cy="7" r="6" fill={last ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" />
      {last ? (
        <path d="M4.5 7.2 6.2 8.8 9.5 5.4" fill="none" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        share > 0 && (
          <circle
            cx="7"
            cy="7"
            r="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={`${circumference * share} ${circumference}`}
            transform="rotate(-90 7 7)"
          />
        )
      )}
    </svg>
  )
}
