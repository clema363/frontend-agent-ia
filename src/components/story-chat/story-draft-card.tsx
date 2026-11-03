import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { IssueTypeIcon, PriorityIcon } from '@/components/kanban/issue-meta'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { StoryDraft } from '@/lib/story-chat'
import { cn } from '@/lib/utils'

type StoryDraftCardProps = {
  draft: StoryDraft
  index: number
  locked: boolean
  onChange: (draft: StoryDraft) => void
  onRemove: () => void
}

// One proposed story; editable inline until the batch is sent to the board.
export function StoryDraftCard({ draft, index, locked, onChange, onRemove }: StoryDraftCardProps) {
  const [editing, setEditing] = useState(false)
  const reduceMotion = useReducedMotion()

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', duration: 0.3, bounce: 0.1, delay: reduceMotion ? 0 : index * 0.06 }}
      className={cn(
        'group/draft rounded-xl border bg-card p-3 shadow-xs transition-colors',
        editing ? 'border-ring ring-3 ring-ring/30' : 'hover:border-foreground/20',
      )}
    >
      <header className="flex items-start gap-2">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-medium text-muted-foreground tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={draft.title}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              className="h-7 text-sm font-medium"
              aria-label="Story title"
              autoFocus
            />
          ) : (
            <h3 className="text-sm leading-snug font-medium">{draft.title}</h3>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><IssueTypeIcon type={draft.type} />{draft.type}</span>
            <span className="flex items-center gap-1"><PriorityIcon priority={draft.priority} />{draft.priority}</span>
            <Badge variant="outline" className="h-5 text-[10px]">{draft.criteria.length} critères</Badge>
          </div>
        </div>
        {!locked && (
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/draft:opacity-100 focus-within:opacity-100 data-[editing=true]:opacity-100" data-editing={editing}>
            <Button size="icon-xs" variant="ghost" onClick={() => setEditing((value) => !value)} aria-label={editing ? 'Finish editing' : 'Edit story'}>
              {editing ? <Check /> : <Pencil />}
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={onRemove} aria-label="Remove story" className="hover:text-destructive">
              <Trash2 />
            </Button>
          </div>
        )}
      </header>

      <div className="mt-2.5 space-y-2 pl-7 text-sm">
        {editing ? (
          <Textarea
            value={`En tant que ${draft.asA}, je veux ${draft.iWant} afin de ${draft.soThat}.`}
            onChange={(event) => {
              const match = event.target.value.match(/En tant que (.+?), je veux (.+?) afin de (.+?)\.?$/s)
              if (match) onChange({ ...draft, asA: match[1], iWant: match[2], soThat: match[3] })
            }}
            className="min-h-16 text-sm"
            aria-label="Story statement"
          />
        ) : (
          <p className="text-muted-foreground">
            En tant que <strong className="font-medium text-foreground">{draft.asA}</strong>, je veux{' '}
            <strong className="font-medium text-foreground">{draft.iWant}</strong> afin de {draft.soThat}.
          </p>
        )}
        <ul className="space-y-1">
          {draft.criteria.map((criterion, i) => (
            <li key={i} className="flex gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 size-3 shrink-0 text-emerald-500" aria-hidden="true" />
              {editing ? (
                <Input
                  value={criterion}
                  onChange={(event) => onChange({ ...draft, criteria: draft.criteria.map((c, j) => (j === i ? event.target.value : c)) })}
                  className="h-6 text-xs"
                  aria-label={`Acceptance criterion ${i + 1}`}
                />
              ) : (
                <span>{criterion}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </motion.article>
  )
}
