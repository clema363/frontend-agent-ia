import { useMemo } from 'react'
import { CalendarDays, CircleDot, FolderOpen, History } from 'lucide-react'
import AILoader from '@/components/smoothui/ai-loader'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { pendingDecision, relativeTime, threadIsRunning, type ChatThread } from '@/lib/story-chat'
import { cn } from '@/lib/utils'

type StoryChatHomeProps = {
  threads: ChatThread[]
  projects: { id: string; name: string }[]
  onSelect: (id: string) => void
}

const WEEKS = 20
const DAY = 86_400_000
const dayFormat = new Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat('fr', { month: 'short' })

function startOfDay(at: number) {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

// Cards under the welcome composer: activity, proposals waiting for a decision, chats to resume.
// Everything comes from the chats themselves; nothing is fetched.
export function StoryChatHome({ threads, projects, onSelect }: StoryChatHomeProps) {
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Sans projet'
  const recent = useMemo(() => [...threads].sort((a, b) => b.updatedAt - a.updatedAt), [threads])
  const pending = recent.filter((thread) => pendingDecision(thread))

  return (
    <div className="grid w-full max-w-4xl gap-3 md:grid-cols-[1.4fr_1fr]">
      <ActivityCard threads={threads} className="md:col-span-2" />
      <HomeCard icon={CircleDot} title="À valider" empty="Aucune proposition en attente.">
        {pending.slice(0, 3).map((thread) => {
          const turn = pendingDecision(thread)!
          return (
            <ThreadRow
              key={thread.id}
              thread={thread}
              onSelect={onSelect}
              meta={turn.kind === 'drafts' ? `${turn.drafts.length} US proposées` : `Diff sur ${turn.story.key}`}
            />
          )
        })}
        {pending.length > 3 && <p className="px-2 pt-1 text-xs text-muted-foreground">{pending.length - 3} de plus</p>}
      </HomeCard>
      <HomeCard icon={History} title="Reprendre" empty="Aucun chat pour l’instant.">
        {recent.slice(0, 3).map((thread) => (
          <ThreadRow key={thread.id} thread={thread} onSelect={onSelect} meta={projectName(thread.projectId)} project />
        ))}
      </HomeCard>
    </div>
  )
}

function HomeCard({ icon: Icon, title, empty, className, children }: {
  icon: typeof History
  title: string
  empty: string
  className?: string
  children: React.ReactNode
}) {
  const hasContent = Array.isArray(children) ? children.some(Boolean) : Boolean(children)
  return (
    <section className={cn('flex flex-col gap-2 rounded-xl border bg-card/70 p-3 shadow-sm backdrop-blur-md', className)}>
      <h3 className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" /> {title}
      </h3>
      {hasContent ? <div className="flex flex-col">{children}</div> : <p className="px-1 py-3 text-xs text-muted-foreground">{empty}</p>}
    </section>
  )
}

function ThreadRow({ thread, meta, project, onSelect }: { thread: ChatThread; meta: string; project?: boolean; onSelect: (id: string) => void }) {
  const running = threadIsRunning(thread)
  return (
    <button
      type="button"
      onClick={() => onSelect(thread.id)}
      className="flex min-w-0 flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
    >
      <span className="w-full truncate text-sm">{thread.title}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        {project && <FolderOpen className="size-3 shrink-0" aria-hidden="true" />}
        <span className="truncate">{meta}</span>
        <span aria-hidden="true">·</span>
        {running ? <AILoader variant="dots" label="L’agent travaille" className="scale-75" /> : <span className="shrink-0">{relativeTime(thread.updatedAt)}</span>}
      </span>
    </button>
  )
}

// GitHub-style grid of chats started per day over the last weeks.
function ActivityCard({ threads, className }: { threads: ChatThread[]; className?: string }) {
  const { weeks, max, created, edits, from } = useMemo(() => {
    const today = startOfDay(Date.now())
    // Columns are weeks ending with the current one, rows go Monday → Sunday.
    const weekday = (new Date(today).getDay() + 6) % 7
    const first = today - (weekday + (WEEKS - 1) * 7) * DAY
    const counts = new Map<number, number>()
    for (const thread of threads) {
      const day = startOfDay(thread.createdAt)
      if (day >= first) counts.set(day, (counts.get(day) ?? 0) + 1)
    }
    const weeks = Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const day = first + (w * 7 + d) * DAY
        return { day, count: counts.get(day) ?? 0, future: day > today }
      }),
    )
    let created = 0
    let edits = 0
    for (const thread of threads) {
      for (const turn of thread.turns) {
        if (turn.from !== 'agent') continue
        if (turn.kind === 'drafts' && turn.decision === 'create') created += turn.drafts.length
        if (turn.kind === 'edit' && turn.decision === 'accepted') edits += 1
      }
    }
    return { weeks, max: Math.max(1, ...counts.values()), created, edits, from: first }
  }, [threads])

  const level = (count: number) => (count === 0 ? 0 : Math.ceil((count / max) * 4))
  const levels = ['bg-muted', 'bg-blue-500/30', 'bg-blue-500/50', 'bg-blue-500/75', 'bg-blue-500']

  return (
    <HomeCard icon={CalendarDays} title="Activité" empty="" className={className}>
      <div className="flex flex-col gap-2 px-1">
        <div className="flex gap-1 overflow-hidden" role="img" aria-label={`${threads.length} chats ces ${WEEKS} dernières semaines`}>
          {weeks.map((days, w) => (
            <div key={w} className="flex flex-1 flex-col gap-1">
              {days.map(({ day, count, future }) => (
                <Tooltip key={day}>
                  <TooltipTrigger
                    render={<div className={cn('aspect-square w-full max-w-4 rounded-[3px]', future ? 'bg-transparent' : levels[level(count)])} />}
                  />
                  {!future && (
                    <TooltipContent>
                      {count} chat{count > 1 ? 's' : ''} · {dayFormat.format(day)}
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            {threads.length} chats · {created} US créées · {edits} modifications acceptées
          </span>
          <span>{monthFormat.format(from)} – {monthFormat.format(Date.now())}</span>
        </div>
      </div>
    </HomeCard>
  )
}
