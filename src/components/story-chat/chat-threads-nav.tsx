import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { FolderOpen, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import AILoader from '@/components/smoothui/ai-loader'
import AIOrbFace from '@/components/smoothui/ai-orb-face'
import DropdownMenu from '@/components/smoothui/dropdown-menu'
import SmoothButton from '@/components/smoothui/smooth-button'
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

// Secondary navbar of the story chat, adapted from SmoothUI's chat-template sidebar:
// open chats grouped by project, searchable, collapsible to an icon rail.
export function ChatThreadsNav({ threads, projects, activeId, collapsed, onToggleCollapsed, onSelect, onNewChat, onRename, onDelete }: ChatThreadsNavProps) {
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const reduceMotion = useReducedMotion()
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
      <aside className="flex h-full w-14 shrink-0 flex-col items-center gap-1.5 border-r bg-muted/40 py-3">
        <RailButton label="Déplier les chats" onClick={onToggleCollapsed}><PanelLeftOpen /></RailButton>
        <RailButton label="Nouveau chat" onClick={() => onNewChat()}><Plus /></RailButton>
        <RailButton label="Rechercher" onClick={() => { onToggleCollapsed(); requestAnimationFrame(() => searchRef.current?.focus()) }}><Search /></RailButton>
        <div className="my-1 h-px w-6 bg-border" />
        {threads.slice(0, 8).map((thread) => (
          <RailButton key={thread.id} label={thread.title} onClick={() => onSelect(thread.id)} active={thread.id === activeId}>
            <AIOrbFace size={20} gaze={false} state={threadIsRunning(thread) ? 'thinking' : 'idle'} />
          </RailButton>
        ))}
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col gap-3 border-r bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-sm font-medium">Chats</span>
        <SmoothButton aria-label="Replier les chats" variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={onToggleCollapsed}>
          <PanelLeftClose />
        </SmoothButton>
      </div>

      <SmoothButton
        variant="outline"
        className="w-full justify-start rounded-xl border-border/60 bg-background px-3 py-2 text-sm"
        onClick={() => onNewChat()}
      >
        <Plus /> Nouveau chat
      </SmoothButton>

      <label className="flex items-center gap-2 rounded-xl border border-transparent bg-muted px-2.5 py-2 transition-colors focus-within:border-border focus-within:bg-background">
        <span className="sr-only">Rechercher un chat</span>
        <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un chat"
          className="w-full appearance-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <nav aria-label="Chats par projet" className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {groups.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {query ? `Aucun chat ne correspond à « ${query} ».` : 'Aucun chat ouvert.'}
          </p>
        )}
        {groups.map(([projectId, items]) => (
          <section key={projectId} className="mb-3">
            <div className="group/project flex items-center gap-1.5 px-2 pt-1 pb-1.5">
              <FolderOpen className="size-3 text-muted-foreground/80" aria-hidden="true" />
              <p className="flex-1 truncate text-[0.7rem] font-medium tracking-wide text-muted-foreground/80 uppercase">{projectName(projectId)}</p>
              <button
                type="button"
                onClick={() => onNewChat(projectId)}
                aria-label={`Nouveau chat dans ${projectName(projectId)}`}
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/project:opacity-100 hover:text-foreground focus-visible:opacity-100"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <ul className="flex flex-col gap-0.5">
              <AnimatePresence initial={false}>
                {items.map((thread) => {
                  const active = thread.id === activeId
                  const running = threadIsRunning(thread)
                  return (
                    <motion.li
                      key={thread.id}
                      layout={!reduceMotion}
                      initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: 'spring', duration: 0.25, bounce: 0.1 }}
                      className={cn(
                        'group/thread relative flex items-center rounded-lg transition-colors',
                        active ? 'bg-background shadow-xs shadow-black/5' : 'hover:bg-background/60',
                      )}
                    >
                      {renaming === thread.id ? (
                        <input
                          autoFocus
                          defaultValue={thread.title}
                          aria-label="Nom du chat"
                          className="m-1 w-full rounded-md border bg-background px-1.5 py-1 text-sm outline-none focus:border-ring"
                          onBlur={(event) => { onRename(thread.id, event.target.value.trim() || thread.title); setRenaming(null) }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur()
                            if (event.key === 'Escape') setRenaming(null)
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          aria-current={active ? 'page' : undefined}
                          onClick={() => onSelect(thread.id)}
                          onDoubleClick={() => setRenaming(thread.id)}
                          className={cn('flex min-w-0 flex-1 flex-col items-start px-2 py-1.5 text-left outline-none', active ? 'text-foreground' : 'text-muted-foreground')}
                        >
                          <span className="flex w-full items-center gap-1.5">
                            <span className="truncate text-sm">{thread.title}</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                            {running ? <AILoader variant="dots" label="L’agent travaille" className="scale-75" /> : relativeTime(thread.updatedAt)}
                            {thread.storyKey && <span className="rounded bg-muted px-1 font-mono">{thread.storyKey}</span>}
                          </span>
                        </button>
                      )}
                      {renaming !== thread.id && (
                        <div className="mr-1 opacity-0 transition-opacity group-hover/thread:opacity-100 has-[[aria-expanded=true]]:opacity-100 focus-within:opacity-100">
                          <DropdownMenu
                            align="start"
                            items={[
                              { key: 'rename', label: 'Renommer', icon: <Pencil className="size-3.5" />, onSelect: () => setRenaming(thread.id) },
                              { key: 'sep', label: '', separator: true },
                              { key: 'delete', label: 'Fermer le chat', icon: <Trash2 className="size-3.5" />, variant: 'destructive', onSelect: () => onDelete(thread.id) },
                            ]}
                          >
                            <button type="button" aria-label={`Actions pour ${thread.title}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                              <MoreHorizontal className="size-3.5" />
                            </button>
                          </DropdownMenu>
                        </div>
                      )}
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  )
}

function RailButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <SmoothButton
      aria-label={label}
      title={label}
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      className={cn('text-muted-foreground', active && 'bg-background text-foreground shadow-xs')}
    >
      {children}
    </SmoothButton>
  )
}
