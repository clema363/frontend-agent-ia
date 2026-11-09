import { useMemo } from 'react'
import { CalendarDays, CircleDot, FileCheck2, History, TrendingUp } from 'lucide-react'
import AILoader from '@/components/smoothui/ai-loader'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { pendingDecision, relativeTime, threadIsRunning, type ChatThread } from '@/lib/story-chat'
import { cn } from '@/lib/utils'

type StoryChatHomeProps = {
  threads: ChatThread[]
  projects: { id: string; name: string }[]
  onSelect: (id: string) => void
}

const WEEKS = 26
const DAY = 86_400_000
const dayFormat = new Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat('fr', { month: 'short' })
const numberFormat = new Intl.NumberFormat('fr')

function startOfDay(at: number) {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function startOfMonth(offset = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(1)
  date.setMonth(date.getMonth() + offset)
  return date.getTime()
}

// US created from accepted drafts, and story edits accepted, in the given chats.
function outcomes(threads: ChatThread[]) {
  let created = 0
  let edits = 0
  for (const thread of threads) {
    for (const turn of thread.turns) {
      if (turn.from !== 'agent') continue
      if (turn.kind === 'drafts' && turn.decision === 'create') created += turn.drafts.length
      if (turn.kind === 'edit' && turn.decision === 'accepted') edits += 1
    }
  }
  return { created, edits }
}

// Glass dashboard under the welcome composer (Devin-like grid): activity, chats to resume,
// stories created, proposals waiting for a decision and this month's numbers.
// Everything comes from the chats themselves; nothing is fetched.
// The page does not scroll, so on short screens only the first row of cards is kept.
export function StoryChatHome({ threads, projects, onSelect }: StoryChatHomeProps) {
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Sans projet'
  const recent = useMemo(() => [...threads].sort((a, b) => b.updatedAt - a.updatedAt), [threads])
  const pending = recent.filter((thread) => pendingDecision(thread))
  const totals = useMemo(() => outcomes(threads), [threads])
  const month = useMemo(() => {
    const thisMonth = threads.filter((thread) => thread.createdAt >= startOfMonth())
    const lastMonth = threads.filter((thread) => thread.createdAt >= startOfMonth(-1) && thread.createdAt < startOfMonth())
    return {
      chats: thisMonth.length,
      chatsDelta: thisMonth.length - lastMonth.length,
      created: outcomes(thisMonth).created,
      createdDelta: outcomes(thisMonth).created - outcomes(lastMonth).created,
    }
  }, [threads])

  return (
    <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-12">
      <ActivityCard threads={threads} totals={totals} className="md:col-span-8" />

      <Panel icon={History} title="Reprendre" className="md:col-span-4">
        {recent.length === 0 && <Empty>Aucun chat pour l’instant.</Empty>}
        {recent.slice(0, 3).map((thread) => (
          <ThreadRow key={thread.id} thread={thread} meta={projectName(thread.projectId)} onSelect={onSelect} />
        ))}
        {recent.length > 3 && <More>{recent.length - 3} de plus</More>}
      </Panel>

      <Panel icon={FileCheck2} title="User stories" className="md:col-span-3 [@media(max-height:760px)]:hidden">
        <div className="flex flex-1 flex-col justify-center gap-1 px-1 py-4">
          <span className="text-3xl font-medium tracking-tight tabular-nums">{numberFormat.format(totals.created)}</span>
          <span className="text-xs text-muted-foreground">créées depuis le chat · {totals.edits} modifications acceptées</span>
        </div>
      </Panel>

      <Panel icon={CircleDot} title="À valider" className="md:col-span-6 [@media(max-height:760px)]:hidden">
        {pending.length === 0 && <Empty>Aucune proposition en attente.</Empty>}
        {pending.slice(0, 3).map((thread) => {
          const turn = pendingDecision(thread)!
          return (
            <ThreadRow
              key={thread.id}
              thread={thread}
              onSelect={onSelect}
              pending
              meta={turn.kind === 'drafts' ? `${turn.drafts.length} US proposées` : `Diff sur ${turn.story.key}`}
            />
          )
        })}
        {pending.length > 3 && <More>{pending.length - 3} de plus</More>}
      </Panel>

      <Panel icon={TrendingUp} title="Ce mois" className="md:col-span-3 [@media(max-height:760px)]:hidden">
        <div className="flex flex-1 flex-col justify-center gap-4 px-1 py-2">
          <MonthStat label="Chats" value={month.chats} delta={month.chatsDelta} className="text-blue-400" />
          <MonthStat label="US créées" value={month.created} delta={month.createdDelta} className="text-sky-300" />
        </div>
      </Panel>
    </div>
  )
}

function Panel({ icon: Icon, title, className, children }: { icon: typeof History; title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('glass flex min-h-40 flex-col gap-2 rounded-xl p-3', className)}>
      <h3 className="flex items-center gap-2 px-1 text-[13px] text-foreground/80">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" /> {title}
      </h3>
      {children}
    </section>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-1 py-3 text-xs text-muted-foreground">{children}</p>
const More = ({ children }: { children: React.ReactNode }) => <p className="mt-auto px-2 text-xs text-muted-foreground">{children}</p>

function MonthStat({ label, value, delta, className }: { label: string; value: number; delta: number; className?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className={cn('text-2xl font-medium tabular-nums', className)}>{value}</span>
        {delta !== 0 && (
          <span className={cn('text-xs tabular-nums', delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </span>
    </div>
  )
}

function ThreadRow({ thread, meta, pending, onSelect }: { thread: ChatThread; meta: string; pending?: boolean; onSelect: (id: string) => void }) {
  const running = threadIsRunning(thread)
  return (
    <button
      type="button"
      onClick={() => onSelect(thread.id)}
      className="group flex min-w-0 items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/5"
    >
      <span className={cn('mt-2 size-1.5 shrink-0 rounded-full', pending ? 'bg-amber-400' : 'bg-foreground/25')} aria-hidden="true" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm">{thread.title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {running ? <AILoader variant="dots" label="L’agent travaille" className="scale-75" /> : <span className="shrink-0">{relativeTime(thread.updatedAt)}</span>}
          <span aria-hidden="true">·</span>
          <span className="truncate">{meta}</span>
        </span>
      </span>
    </button>
  )
}

// GitHub-style grid of chats started per day over the last six months.
function ActivityCard({ threads, totals, className }: { threads: ChatThread[]; totals: { created: number; edits: number }; className?: string }) {
  const { weeks, max, from } = useMemo(() => {
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
    return { weeks, max: Math.max(1, ...counts.values()), from: first }
  }, [threads])

  const levels = ['bg-foreground/[0.07]', 'bg-blue-500/35', 'bg-blue-500/55', 'bg-blue-500/80', 'bg-blue-400']
  const level = (count: number) => (count === 0 ? 0 : Math.ceil((count / max) * 4))

  return (
    <Panel icon={CalendarDays} title="Activité" className={className}>
      <div className="flex flex-1 flex-col justify-between gap-3 px-1">
        <div className="flex gap-[3px]" role="img" aria-label={`${threads.length} chats ces ${WEEKS} dernières semaines`}>
          {weeks.map((days, w) => (
            <div key={w} className="flex flex-1 flex-col gap-[3px]">
              {days.map(({ day, count, future }) => (
                <Tooltip key={day}>
                  <TooltipTrigger render={<div className={cn('aspect-square w-full rounded-[3px]', future ? 'bg-transparent' : levels[level(count)])} />} />
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
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate tabular-nums">
            {threads.length} chats · {totals.created} US créées · {totals.edits} modifications acceptées
          </span>
          <span className="shrink-0 capitalize">
            {monthFormat.format(from)} – {monthFormat.format(Date.now())}
          </span>
        </div>
      </div>
    </Panel>
  )
}
