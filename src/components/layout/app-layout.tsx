import { useState } from 'react'
import { Outlet } from 'react-router'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { PageHeaderContext } from '@/components/layout/page-header-context'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

// Like Linear: the sidebar sits on the background and the view is a full-width framed panel.
export function AppLayout() {
  const [headerContainer, setHeaderContainer] = useState<HTMLDivElement | null>(null)

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh overflow-hidden">
        <AppSidebar />
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:shadow-none">
          <PageHeaderContext.Provider value={headerContainer}>
            <div ref={setHeaderContainer} className="relative z-10 shrink-0 bg-background" />
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-6 pt-6 pb-10">
              <Outlet />
            </div>
          </PageHeaderContext.Provider>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
