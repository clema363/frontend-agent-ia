import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useMe, useProjects } from '@/api/hooks'
import {
  ChevronRight,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  SquareKanban,
  User,
  Loader,
  Code2,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'

const PROJECTS_OPEN_KEY = 'atlas.sidebar.projectsOpen'

// Projects link to the list page; only the chevron folds the project list (persisted, like Aceternity's grouped sidebar).
// Inside a project, only that project's row is highlighted, not the Projects row.
function ProjectsNavItem() {
  const { pathname } = useLocation()
  const { data: projects = [] } = useProjects()
  const [open, setOpen] = useState(() => localStorage.getItem(PROJECTS_OPEN_KEY) !== 'false')

  const toggle = () => {
    setOpen((current) => {
      localStorage.setItem(PROJECTS_OPEN_KEY, String(!current))
      return !current
    })
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={pathname === '/projects'} tooltip="Projects" render={<NavLink to="/projects" end />}>
        <FolderOpen />
        <span>Projects</span>
      </SidebarMenuButton>
      {projects.length > 0 && (
        <>
          <SidebarMenuAction
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? 'Collapse projects' : 'Expand projects'}
          >
            <ChevronRight className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
          </SidebarMenuAction>
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            inert={!open}
          >
            <SidebarMenuSub className="mr-0 min-h-0 gap-0 overflow-hidden py-0 pr-0">
              {projects.map((project) => {
                const to = `/projects/${project.id}`
                return (
                  <SidebarMenuSubItem key={project.id} className="pt-0.5">
                    <SidebarMenuSubButton
                      className="h-8"
                      isActive={pathname === to || pathname.startsWith(`${to}/`)}
                      render={<NavLink to={to} />}
                    >
                      <span>{project.name}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )
              })}
            </SidebarMenuSub>
          </div>
        </>
      )}
    </SidebarMenuItem>
  )
}

const navItems = [
  { title: 'Dashboard', to: '/', icon: LayoutDashboard },
  { title: 'Projects', to: '/projects', icon: FolderOpen },
  { title: 'Kanban', to: '/kanban', icon: SquareKanban },
  { title: 'Editor', to: '/editor', icon: Code2 },
  { title: 'Journal', to: '/journal', icon: ScrollText },
  { title: 'Settings', to: '/settings', icon: Settings },
]

export function AppSidebar() {
  const { pathname } = useLocation()
  const { data: me } = useMe()

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<NavLink to="/" />}>
              <div className="flex aspect-square size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <Loader className="size-4" />
              </div>
              <span className="text-sm font-semibold">Atlas</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => item.to === '/projects' ? <ProjectsNavItem key={item.to} /> : (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    isActive={item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)}
                    tooltip={item.title}
                    render={<NavLink to={item.to} end />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Profile" isActive={pathname === '/profile'} render={<NavLink to="/profile" />}>
              <User />
              <span>Profile</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sign out" render={<NavLink to="/login" />}>
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {me ? `Signed in: ${me.name} · ${me.isAdmin ? 'ADMIN' : me.role}` : 'Loading account…'}
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
