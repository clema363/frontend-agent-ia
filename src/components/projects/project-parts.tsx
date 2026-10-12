import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// Shared elements for the project page and its dialogs.

// Dialogs: fixed header and scrollable body.
export const projectDialogClassName = 'flex max-h-[min(90vh,56rem)] flex-col gap-0 p-0'

type ProjectDialogHeaderProps = {
  icon: LucideIcon
  title: string
  project?: string
  children?: ReactNode
}

export function ProjectDialogHeader({ icon: Icon, title, project, children }: ProjectDialogHeaderProps) {
  return (
    <DialogHeader className="gap-1.5 border-b p-5 pr-12">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          {project && <p className="font-mono text-xs text-muted-foreground">{project}</p>}
        </div>
      </div>
      {children && <DialogDescription className="pt-2">{children}</DialogDescription>}
    </DialogHeader>
  )
}

export function ProjectDialogBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto p-5', className)}>{children}</div>
}

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground',
        className,
      )}
    >
      {initials}
    </span>
  )
}

type SectionHeaderProps = {
  title: string
  count?: number
  actions?: ReactNode
  children?: ReactNode
}

// Project section header: subtle title, description and actions on the right.
export function SectionHeader({ title, count, actions, children }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">
          {title}
          {count !== undefined && <span className="ml-2 font-normal text-muted-foreground tabular-nums">{count}</span>}
        </h2>
        {children && <p className="text-sm text-muted-foreground">{children}</p>}
      </div>
      {actions}
    </div>
  )
}

// Roles (hats) displayed as small badges.
export function RoleBadges({ roles }: { roles: string[] }) {
  if (roles.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <span key={role} className="rounded border px-1.5 py-px text-[11px] leading-4 text-muted-foreground">
          {role}
        </span>
      ))}
    </span>
  )
}
