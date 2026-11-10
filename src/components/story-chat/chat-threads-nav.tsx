import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, CircleAlert, FolderCode, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Search, SquarePen, Trash2 } from 'lucide-react'
import AILoader from '@/components/smoothui/ai-loader'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ChatThread } from '@/lib/story-chat'
import { pendingDecision, threadIsRunning } from '@/lib/story-chat'
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

const CLOSED_KEY = 'atlas.storyChat.closedProjects'
// Chats shown per project before "Voir plus", like Codex's sidebar.
const RECENT_LIMIT = 5

// Secondary navbar of the story chat, styled like a code editor's thread list:
// open chats grouped by project, one line each, searchable, collapsible to an icon rail.
// Only the agent signals (orb, loader) come from SmoothUI.
export function ChatThreadsNav({ threads, projects, activeId, collapsed, onToggleCollapsed, onSelect, onNewChat, onRename, onDelete }: ChatThreadsNavProps) {
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // Folded projects are remembered in this browser.
  const [closed, setClosed] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(CLOSED_KEY) ?? '[]') as string[]))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const activeProject = threads.find((thread) => thread.id === activeId)?.projectId
  const isOpen = (projectId: string) => !closed.has(projectId)
  // Opening a chat (from the URL, a new chat…) unfolds its project once; the user can fold it again.
  useEffect(() => {
    if (activeProject && closed.has(activeProject)) setOpen(activeProject, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject])
  function setOpen(projectId: string, open: boolean) {
    setClosed((current) => {
      const next = new Set(current)
      if (open) next.delete(projectId)
      else next.add(projectId)
      localStorage.setItem(CLOSED_KEY, JSON.stringify([...next]))
      return next
    })
  }
  function toggleExpanded(projectId: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }
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
    // Folded rail: one square per project (most recent first) instead of one face per chat.
    // A dot tells when its agent works (blue) or a proposal waits (amber); a click opens its latest chat.
    const railProjects: { projectId: string; latest: ChatThread; count: number; running: boolean; pending: boolean }[] = []
    for (const thread of [...threads].sort((a, b) => b.updatedAt - a.updatedAt)) {
      let entry = railProjects.find((item) => item.projectId === thread.projectId)
      if (!entry) {
        entry = { projectId: thread.projectId, latest: thread, count: 0, running: false, pending: false }
        railProjects.push(entry)
      }
      entry.count += 1
      entry.running ||= threadIsRunning(thread)
      entry.pending ||= Boolean(pendingDecision(thread))
    }
    return (
      <aside className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-3">
        <RailButton label="Déplier les chats" onClick={onToggleCollapsed}><PanelLeftOpen /></RailButton>
        <RailButton label="Nouveau chat" onClick={() => onNewChat()}><Plus /></RailButton>
        <RailButton label="Rechercher" onClick={() => { onToggleCollapsed(); requestAnimationFrame(() => searchRef.current?.focus()) }}><Search /></RailButton>
        <div className="my-1 h-px w-6 bg-sidebar-border" />
        {railProjects.map(({ projectId, latest, count, running, pending }) => (
          <RailButton
            key={projectId}
            label={`${projectName(projectId)} · ${count} chat${count > 1 ? 's' : ''}${running ? ' · l’agent travaille' : pending ? ' · à valider' : ''}`}
            onClick={() => onSelect(latest.id)}
            active={projectId === activeProject}
          >
            <span className="relative">
              <ProjectAvatar name={projectName(projectId)} />
              {(running || pending) && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-sidebar',
                    running ? 'animate-pulse bg-blue-500' : 'bg-amber-500',
                  )}
                />
              )}
            </span>
          </RailButton>
        ))}
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Top bar: a borderless search field with the actions as plain icons, like a code editor's thread list. */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Escape') setQuery('') }}
            placeholder="Rechercher"
            aria-label="Rechercher un chat"
            className="h-7 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        <IconAction label="Nouveau chat" onClick={() => onNewChat()}><SquarePen /></IconAction>
        <IconAction label="Replier les chats" onClick={onToggleCollapsed}><PanelLeftClose /></IconAction>
      </div>

      <nav aria-label="Chats par projet" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {query ? `Aucun chat ne correspond à « ${query} ».` : 'Aucun chat ouvert.'}
          </p>
        )}
        {groups.map(([projectId, items]) => (
          <Collapsible
            key={projectId}
            // Searching opens every group so matches are never hidden.
            open={Boolean(query.trim()) || isOpen(projectId)}
            onOpenChange={(open) => setOpen(projectId, open)}
            className="group/project mt-3 first:mt-0"
          >
            <div className="relative flex items-center">
              <CollapsibleTrigger className="group/label flex h-8 w-full min-w-0 items-center gap-2.5 rounded-md px-2 text-left text-sm font-medium outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                <FolderCode className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{projectName(projectId)}</span>
                <ChevronDown
                  className="ml-auto size-3.5 shrink-0 text-muted-foreground -rotate-90 transition-transform duration-200 group-data-[panel-open]/label:rotate-0"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <button
                type="button"
                onClick={() => onNewChat(projectId)}
                aria-label={`Nouveau chat dans ${projectName(projectId)}`}
                className="absolute right-7 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none group-hover/project:opacity-100 hover:bg-sidebar-border hover:text-foreground focus-visible:opacity-100 [&_svg]:size-3.5"
              >
                <Plus />
              </button>
            </div>
            <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
              <ul className="flex flex-col gap-0.5 pt-0.5">
                {(expanded.has(projectId) || query.trim() ? items : items.slice(0, RECENT_LIMIT)).map((thread) => {
                  const running = threadIsRunning(thread)
                  const pending = !running && Boolean(pendingDecision(thread))
                  const active = thread.id === activeId
                  return (
                    <li key={thread.id} className="group/thread relative">
                      {renaming === thread.id ? (
                        <Input
                          autoFocus
                          defaultValue={thread.title}
                          aria-label="Nom du chat"
                          className="h-8 bg-background pl-8.5 text-sm"
                          onBlur={(event) => { onRename(thread.id, event.target.value.trim() || thread.title); setRenaming(null) }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur()
                            if (event.key === 'Escape') setRenaming(null)
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelect(thread.id)}
                          onDoubleClick={() => setRenaming(thread.id)}
                          aria-current={active ? 'page' : undefined}
                          title={thread.storyKey ? `${thread.title} · ${thread.storyKey}` : thread.title}
                          className={cn(
                            'flex h-8 w-full min-w-0 items-center gap-2 rounded-md pr-2 pl-8.5 text-left text-sm outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                            active ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'text-muted-foreground hover:text-sidebar-foreground',
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                          {/* Status, then age; the age gives way to the menu on hover. */}
                          {running && <AILoader variant="dots" label="L’agent travaille" className="shrink-0 scale-75" />}
                          {pending && (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500">
                              <CircleAlert className="size-3.5" aria-hidden="true" /> À valider
                            </span>
                          )}
                          {!running && !pending && (
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground group-hover/thread:invisible">{shortAge(thread.updatedAt)}</span>
                          )}
                        </button>
                      )}
                      {renaming !== thread.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                aria-label={`Actions pour ${thread.title}`}
                                className={cn(
                                  'absolute top-1 right-1 flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-sidebar-border hover:text-foreground focus-visible:opacity-100 data-[popup-open]:opacity-100 [&_svg]:size-4',
                                  running || pending ? 'hidden group-hover/thread:flex data-[popup-open]:flex' : 'opacity-0 group-hover/thread:opacity-100',
                                )}
                              />
                            }
                          >
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
                    </li>
                  )
                })}
                {items.length > RECENT_LIMIT && !query.trim() && (
                  <li>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(projectId)}
                      className="flex h-7 w-full items-center rounded-md pl-8.5 text-left text-xs text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    >
                      {expanded.has(projectId) ? 'Voir moins' : `Voir ${items.length - RECENT_LIMIT} de plus`}
                    </button>
                  </li>
                )}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </nav>
    </aside>
  )
}

// Compact age for the thread list: "5 min", "16h", "3j".
function shortAge(at: number) {
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60000))
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}j`
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={label} className="text-muted-foreground hover:text-foreground" />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

// Square with the project's initial, tinted from its name so each project keeps its color.
const avatarColors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500']
function ProjectAvatar({ name }: { name: string }) {
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const initial = name.replace(/^[^a-zA-Z]+/, '').charAt(0).toUpperCase() || '?'
  return (
    <span aria-hidden="true" className={cn('flex size-6 items-center justify-center rounded-md text-xs font-semibold text-white', avatarColors[hash % avatarColors.length])}>
      {initial}
    </span>
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
