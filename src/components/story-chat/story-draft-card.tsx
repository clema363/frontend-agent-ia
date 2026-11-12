import { useState } from 'react'
import type * as React from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, ChevronDown, FileText, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
import { IssueTypeDot, PriorityBars } from '@/components/kanban/issue-meta'
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

// One proposed story, drawn like a kanban card so the user sees what will land in To author.
// Each one is accepted or rejected on its own; the raw need it came from stays visible.
export function StoryDraftCard({ draft, index, locked, onChange, onRemove }: StoryDraftCardProps) {
  const [editing, setEditing] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const reduceMotion = useReducedMotion()
  const accepted = draft.verdict === 'accepted'
  const rejected = draft.verdict === 'rejected'
  const setVerdict = (verdict: StoryDraft['verdict']) => {
    setEditing(false)
    onChange({ ...draft, verdict })
  }

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', duration: 0.3, bounce: 0.1, delay: reduceMotion ? 0 : index * 0.06 }}
      className={cn(
        'group/draft relative flex flex-col gap-1 rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-xs transition-colors',
        editing && 'border-ring ring-3 ring-ring/30',
        !editing && accepted && 'border-emerald-500/50 bg-emerald-500/[0.03]',
        !editing && rejected && 'border-dashed bg-muted/30 shadow-none',
        !editing && !draft.verdict && 'hover:border-foreground/20',
      )}
    >
      {/* Top row, same as a kanban card: key slot, then where the story is headed. */}
      <div className="flex h-5 items-center gap-1.5 text-xs text-muted-foreground">
        <span className="shrink-0 font-mono">US-{String(index + 1).padStart(2, '0')}</span>
        <span className="rounded border border-dashed px-1 text-[10px]">brouillon</span>
        <VerdictStatus verdict={draft.verdict} />
        {!locked && !draft.verdict && (
          <div
            className="ml-auto flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/draft:opacity-100 focus-within:opacity-100 data-[editing=true]:opacity-100"
            data-editing={editing}
          >
            <Button size="icon-xs" variant="ghost" onClick={() => setEditing((value) => !value)} aria-label={editing ? 'Terminer la modification' : 'Modifier la story'}>
              {editing ? <Check /> : <Pencil />}
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={onRemove} aria-label="Retirer la story" className="hover:text-destructive">
              <Trash2 />
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <Input
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          className="h-7 text-sm font-medium"
          aria-label="Titre de la story"
          autoFocus
        />
      ) : (
        <h3 className={cn('leading-snug font-medium', rejected && 'text-muted-foreground line-through decoration-muted-foreground/50')}>
          {draft.title}
        </h3>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <Chip className="px-1" title={`Priorité ${draft.priority}`}>
          <PriorityBars priority={draft.priority} />
        </Chip>
        <Chip>
          <IssueTypeDot type={draft.type} />
          {draft.type}
        </Chip>
        <Chip>{draft.criteria.length} critères</Chip>
      </div>

      {/* Rejected stories collapse to their header: they won't be created. */}
      {!rejected && (
        <div className="mt-2 space-y-2 border-t pt-2">
          {editing ? (
            <Textarea
              value={`En tant que ${draft.asA}, je veux ${draft.iWant} afin de ${draft.soThat}.`}
              onChange={(event) => {
                const match = event.target.value.match(/En tant que (.+?), je veux (.+?) afin de (.+?)\.?$/s)
                if (match) onChange({ ...draft, asA: match[1], iWant: match[2], soThat: match[3] })
              }}
              className="min-h-16 text-sm"
              aria-label="Énoncé de la story"
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
                    aria-label={`Critère d’acceptation ${i + 1}`}
                  />
                ) : (
                  <span>{criterion}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw need: what the backend receives as `need`, before any agent processing. */}
      {(draft.rawNeed || editing) && (
        <div className="mt-2 rounded-md bg-muted/50">
          <button
            type="button"
            onClick={() => setShowRaw((value) => !value)}
            aria-expanded={showRaw || editing}
            className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            <FileText className="size-3 shrink-0" aria-hidden="true" />
            <span className="font-medium">Besoin brut</span>
            {!(showRaw || editing) && <span className="min-w-0 truncate opacity-70">— {draft.rawNeed.split('\n')[0]}</span>}
            <ChevronDown className={cn('ml-auto size-3 shrink-0 transition-transform', (showRaw || editing) && 'rotate-180')} aria-hidden="true" />
          </button>
          {(showRaw || editing) && (
            <div className="px-2 pb-2">
              {editing ? (
                <Textarea
                  value={draft.rawNeed ?? ''}
                  onChange={(event) => onChange({ ...draft, rawNeed: event.target.value })}
                  className="min-h-16 font-mono text-xs"
                  aria-label="Besoin brut"
                />
              ) : (
                <p className="font-mono text-xs whitespace-pre-wrap text-foreground/80">{draft.rawNeed}</p>
              )}
            </div>
          )}
        </div>
      )}

      {!locked && (
        <div className="mt-2 flex items-center gap-1.5">
          {draft.verdict ? (
            <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => setVerdict(undefined)}>
              <RotateCcw /> Annuler
            </Button>
          ) : (
            <>
              <Button size="xs" onClick={() => setVerdict('accepted')}>
                <Check /> Accepter
              </Button>
              <Button size="xs" variant="outline" onClick={() => setVerdict('rejected')}>
                <X /> Rejeter
              </Button>
            </>
          )}
        </div>
      )}
    </motion.article>
  )
}

function VerdictStatus({ verdict }: { verdict: StoryDraft['verdict'] }) {
  if (verdict === 'accepted') {
    return (
      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <ArrowRight className="size-3" aria-hidden="true" /> To author
      </span>
    )
  }
  if (verdict === 'rejected') return <span>Ne sera pas créée</span>
  return null
}

// Bordered label chip, same look as the kanban card labels.
function Chip({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[11px] whitespace-nowrap text-muted-foreground', className)}
      {...props}
    />
  )
}
