import { useMemo, useRef, useState } from 'react'
import { FolderOpen, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import AILoader from '@/components/smoothui/ai-loader'
import AIOrbFace from '@/components/smoothui/ai-orb-face'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ChatThread } from '@/lib/story-chat'
import { threadIsRunning } from '@/lib/story-chat'
import { cn } from '@/lib/utils'

type ChatThreadsNavProps = {
  threads: ChatThread[]
  projects: { id: string; name: string }[]
  activeId: string | null
  collapsed: boolean
  onToggleCollapsed: () => void
  onSelect: (id: string) => void
  onNewChat: (projectId?: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

const timeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
function relativeTime(at: number) {
  const minutes = Math.round((at - Date.now()) / 60000)
  if (Math.abs(minutes) < 60) return timeFormat.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return timeFormat.format(hours, 'hour')
  return timeFormat.format(Math.round(hours / 24), 'day')
}

// Secondary navbar of the story chat, built on the same shadcn sidebar parts as the app sidebar:
// open chats grouped by project, searchable, collapsible to an icon rail.
// Only the agent signals (orb, loader) come from SmoothUI.
export function ChatThreadsNav({ threads, projects, activeId, collapsed, onToggleCollapsed, onSelect, onNewChat, onRename, onDelete }: ChatThreadsNavProps) {
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Sans projet'

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const byProject = new Map<string, ChatThread[]>()
    for (const thread of [...threads].sort((a, b) => b.updatedAt - a.updatedAt)) {
      if (needle && !thread.title.toLowerCase().includes(needle)) continue
      byProject.set(thread.projectId, [...(byProject.get(thread.projectId) ?? []), thread])
    }
    return [...byProject.entries()]
  }, [threads, query])

  if (collapsed) {
    return (
      <aside className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-3">
        <RailButton label="Déplier les chats" onClick={onToggleCollapsed}><PanelLeftOpen /></RailButton>
        <RailButton label="Nouveau chat" onClick={() => onNewChat()}><Plus /></RailButton>
        <RailButton label="Rechercher" onClick={() => { onToggleCollapsed(); requestAnimationFrame(() => searchRef.current?.focus()) }}><Search /></RailButton>
        <div className="my-1 h-px w-6 bg-sidebar-border" />
        {threads.slice(0, 8).map((thread) => (
          <RailButton key={thread.id} label={thread.title} onClick={() => onSelect(thread.id)} active={thread.id === activeId}>
            <AIOrbFace size={20} gaze={false} state={threadIsRunning(thread) ? 'thinking' : 'idle'} />
          </RailButton>
        ))}
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex flex-col gap-2 p-2">
        <div className="flex items-center justify-between pl-2">
          <span className="text-sm font-medium">Chats</span>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={onToggleCollapsed} aria-label="Replier les chats">
            <PanelLeftClose />
          </Button>
        </div>
        <Button variant="outline" className="w-full justify-start" onClick={() => onNewChat()}>
          <Plus /> Nouveau chat
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un chat"
            aria-label="Rechercher un chat"
            className="h-8 bg-background pl-8"
          />
        </div>
      </div>

      <nav aria-label="Chats par projet" className="min-h-0 flex-1 overflow-y-auto">
        {groups.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            {query ? `Aucun chat ne correspond à « ${query} ».` : 'Aucun chat ouvert.'}
          </p>
        )}
        {groups.map(([projectId, items]) => (
          <SidebarGroup key={projectId} className="py-1">
            <SidebarGroupLabel className="gap-2 pr-8">
              <FolderOpen /><span className="truncate">{projectName(projectId)}</span>
            </SidebarGroupLabel>
            <SidebarGroupAction onClick={() => onNewChat(projectId)} aria-label={`Nouveau chat dans ${projectName(projectId)}`} className="top-2.5">
              <Plus />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((thread) => {
                  const running = threadIsRunning(thread)
                  return (
                    <SidebarMenuItem key={thread.id}>
                      {renaming === thread.id ? (
                        <Input
                          autoFocus
                          defaultValue={thread.title}
                          aria-label="Nom du chat"
                          className="h-auto bg-background py-1.5"
                          onBlur={(event) => { onRename(thread.id, event.target.value.trim() || thread.title); setRenaming(null) }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur()
                            if (event.key === 'Escape') setRenaming(null)
                          }}
                        />
                      ) : (
                        <SidebarMenuButton
                          size="lg"
                          isActive={thread.id === activeId}
                          onClick={() => onSelect(thread.id)}
                          onDoubleClick={() => setRenaming(thread.id)}
                          className="h-auto flex-col items-start gap-0.5 py-1.5"
                        >
                          <span className="w-full truncate">{thread.title}</span>
                          <span className="flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
                            {running ? <AILoader variant="dots" label="L’agent travaille" className="scale-75" /> : relativeTime(thread.updatedAt)}
                            {thread.storyKey && <span className="rounded bg-muted px-1 font-mono">{thread.storyKey}</span>}
                          </span>
                        </SidebarMenuButton>
                      )}
                      {renaming !== thread.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<SidebarMenuAction showOnHover className="top-2" aria-label={`Actions pour ${thread.title}`} />}>
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start">
                            <DropdownMenuItem onClick={() => setRenaming(thread.id)}>
                              <Pencil /> Renommer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => onDelete(thread.id)}>
                              <Trash2 /> Fermer le chat
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </nav>
    </aside>
  )
}

function RailButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            aria-label={label}
            className={cn('text-muted-foreground', active && 'bg-sidebar-accent text-sidebar-accent-foreground')}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
