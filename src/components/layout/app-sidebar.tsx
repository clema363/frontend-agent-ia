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
  Workflow,
  MessagesSquare,
  ChartLine,
} from 'lucide-react'
import { AIOrbIcon } from '@/components/icons/ai-orb-icon'
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

// Collapsed rail, Codex-like: a narrow strip of 36px rounded buttons with 20px icons,
// edge to edge (no group padding) and packed closely. The open sidebar is unchanged.
const rail = 'group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:[&_svg]:size-5'
const railMenu = 'group-data-[collapsible=icon]:gap-1'
const railGroup = 'group-data-[collapsible=icon]:px-0'
// Visible only in the rail, to split the nav into groups like Codex does.
const railSeparator = 'mx-auto my-2 hidden w-5! group-data-[collapsible=icon]:block'

function initials(name?: string) {
  if (!name) return '?'
  const words = name.trim().split(/\s+/)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}

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
      <SidebarMenuButton className={rail} isActive={pathname === '/projects'} tooltip="Projects" render={<NavLink to="/projects" end />}>
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

// Two groups: the day-to-day work, then the tools. The rail shows a short line between them.
const navGroups = [
  [
    { title: 'Dashboard', to: '/', icon: LayoutDashboard },
    { title: 'Projects', to: '/projects', icon: FolderOpen },
    { title: 'Kanban', to: '/kanban', icon: SquareKanban },
    { title: 'Story chat', to: '/chat', icon: MessagesSquare },
    { title: 'Insights', to: '/insights', icon: ChartLine },
  ],
  [
    { title: 'Editor', to: '/editor', icon: Code2 },
    { title: 'Journal', to: '/journal', icon: ScrollText },
    { title: 'Schéma', to: '/schema', icon: Workflow },
    { title: 'AI Lab', to: '/lab', icon: AIOrbIcon },
    { title: 'Settings', to: '/settings', icon: Settings },
  ],
]

export function AppSidebar() {
  const { pathname } = useLocation()
  const { data: me } = useMe()

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className={railGroup}>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center" render={<NavLink to="/" />}>
              <div className="flex aspect-square size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <Loader className="size-4" />
              </div>
              <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">Atlas</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className={railGroup}>
          <SidebarGroupContent>
            {navGroups.map((items, index) => (
              <div key={index}>
                {index > 0 && <SidebarSeparator className={railSeparator} />}
                <SidebarMenu className={railMenu}>
                  {items.map((item) => item.to === '/projects' ? <ProjectsNavItem key={item.to} /> : (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        className={rail}
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
              </div>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />

      <SidebarFooter className={railGroup}>
        <SidebarMenu className={railMenu}>
          <SidebarMenuItem>
            <SidebarMenuButton className={rail} tooltip="Sign out" render={<NavLink to="/login" />}>
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className={rail} tooltip="Profile" isActive={pathname === '/profile'} render={<NavLink to="/profile" />}>
              <User className="group-data-[collapsible=icon]:hidden" />
              {/* In the rail, the profile is the user's initials in a round badge, at the very bottom. */}
              <span className="hidden size-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-medium text-amber-950 group-data-[collapsible=icon]:-m-1 group-data-[collapsible=icon]:flex">
                {initials(me?.name)}
              </span>
              <span>Profile</span>
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
