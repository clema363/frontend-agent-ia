import { Skeleton } from '@/components/ui/skeleton'
import type { StageId } from '@/lib/domain'

const writing: Record<StageId, string> = {
  authoring: 'Writing the first draft…',
  refinement: 'Refining the story…',
  specification: 'Writing the spec…',
  plan: 'Preparing the plan…',
}

type AgentActivityProps = {
  stageId: StageId
  // The agent waits for answers to its questions (docked below) before writing.
  waiting?: boolean
}

// The current stage agent at work: a title, then the outline of the document to come,
// so the document takes this place without a jump.
export function AgentActivity({ stageId, waiting = false }: AgentActivityProps) {
  return (
    <section aria-live="polite" aria-busy={!waiting} className="space-y-4">
      <h3 className="text-sm font-medium">
        {waiting ? <span className="text-muted-foreground">Answer the questions below to start the draft</span> : <span className="text-shimmer">{writing[stageId]}</span>}
      </h3>
      <div className="space-y-2.5" aria-hidden="true">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-3 w-full [animation-delay:150ms]" />
        <Skeleton className="h-3 w-11/12 [animation-delay:300ms]" />
        <Skeleton className="h-3 w-3/5 [animation-delay:450ms]" />
        <Skeleton className="mt-5 h-4 w-1/4 [animation-delay:600ms]" />
        {[78, 64, 70].map((width, line) => (
          <div key={line} className="flex items-center gap-2">
            <Skeleton className="size-1.5 rounded-full" style={{ animationDelay: `${750 + line * 150}ms` }} />
            <Skeleton className="h-3" style={{ width: `${width}%`, animationDelay: `${750 + line * 150}ms` }} />
          </div>
        ))}
      </div>
    </section>
  )
}
