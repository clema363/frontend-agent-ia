import { ChevronRight, type LucideIcon } from 'lucide-react'
import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { PageHeaderContext } from '@/components/layout/page-header-context'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  icon: LucideIcon
  // Parent page shown in the breadcrumb (Projects › 6804-cashgpt).
  parent?: { label: string; to: string }
  actions?: ReactNode
  // Extra context faded in after the title, e.g. the story title once it has scrolled away.
  detail?: { text: string; visible: boolean }
}

// Keep the header separate from the content so it stays still during scroll bounce.
export function PageHeader({ title, icon: Icon, parent, actions, detail }: PageHeaderProps) {
  const headerContainer = useContext(PageHeaderContext)
  const header = (
    <header className="flex h-12 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger className="text-muted-foreground" />
      <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-center" />
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {parent && (
          <>
            <Link to={parent.to} className="text-muted-foreground transition-colors hover:text-foreground">
              {parent.label}
            </Link>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          </>
        )}
        <h1 className="shrink-0 font-medium">{title}</h1>
        {detail && (
          <span
            aria-hidden={!detail.visible}
            className={cn('truncate text-muted-foreground transition-opacity duration-200', detail.visible ? 'opacity-100' : 'opacity-0')}
          >
            {detail.text}
          </span>
        )}
      </nav>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </header>
  )

  return headerContainer ? createPortal(header, headerContainer) : null
}
