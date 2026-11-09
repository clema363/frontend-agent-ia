import { useEffect, useRef, useState } from 'react'
import { ChartLine, RotateCcw } from 'lucide-react'
import { GenerativeUI } from '@/components/generative-ui/generative-ui'
import { PageHeader } from '@/components/layout/page-header'
import { Markdown } from '@/components/markdown'
import AIConversation from '@/components/smoothui/ai-conversation'
import type { AIState } from '@/components/smoothui/ai-core'
import AIMessage from '@/components/smoothui/ai-message'
import AIOrbFace from '@/components/smoothui/ai-orb-face'
import AIPromptInput from '@/components/smoothui/ai-prompt-input'
import AITaskList from '@/components/smoothui/ai-task-list'
import { DotGridBackground } from '@/components/story-chat/dot-grid-background'
import { Button } from '@/components/ui/button'
import {
  buildInsightsTurn,
  insightsSuggestions,
  simulateInsightsReply,
  type InsightsAgentTurn,
  type InsightsTurn,
} from '@/lib/generative-ui/insights-demo'

let idSeq = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++idSeq}`

// Ask a question about usage, get the answer as UI: the agent replies with a json-render spec
// (metrics, charts, tables) drawn from the insights catalog. Replies are simulated for now.
export function InsightsPage() {
  const [turns, setTurns] = useState<InsightsTurn[]>([])
  const stopReply = useRef<(() => void) | null>(null)
  useEffect(() => () => stopReply.current?.(), [])

  const running = turns.find((turn): turn is InsightsAgentTurn => turn.from === 'agent' && turn.status !== 'done')
  const orbState: AIState = running ? (running.status === 'thinking' ? 'thinking' : 'streaming') : 'idle'

  function updateTurn(next: InsightsAgentTurn) {
    setTurns((current) => current.map((turn) => (turn.id === next.id ? next : turn)))
  }

  function send(text: string) {
    if (running || !text.trim()) return
    const agent = buildInsightsTurn(nextId('turn'), text)
    setTurns((current) => [...current, { id: nextId('turn'), from: 'user', text }, agent])
    stopReply.current = simulateInsightsReply(agent, text, updateTurn)
  }

  function stop() {
    stopReply.current?.()
    if (running) updateTurn({ ...running, status: 'done', tasks: running.tasks.map((t) => (t.status === 'done' ? t : { ...t, status: 'failed' })) })
  }

  function reset() {
    stopReply.current?.()
    setTurns([])
  }

  const composer = (glass = false) => (
    <AIPromptInput
      className={glass ? 'border-foreground/15 bg-transparent' : undefined}
      aria-label="Question sur l’usage"
      placeholder="Pose une question sur l’usage : tokens, chats, agents, projets…"
      state={orbState}
      onSubmit={send}
      onStop={stop}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Insights"
        icon={ChartLine}
        actions={
          turns.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw /> Nouvelle analyse
            </Button>
          )
        }
      />
      {turns.length === 0 ? (
        <div className="relative min-h-0 flex-1">
          <DotGridBackground />
          <div className="relative h-full overflow-hidden">
            <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center gap-4 px-6 pb-[10vh]">
              <div className="flex items-center gap-2.5">
                <AIOrbFace size={30} state="idle" />
                <h2 className="text-2xl font-medium tracking-tight">Insights</h2>
              </div>
              <div className="rounded-2xl bg-background/70 shadow-[0_12px_48px_-12px_rgb(0_0_0/0.6)] backdrop-blur-2xl backdrop-saturate-150">{composer(true)}</div>
              <div className="flex flex-wrap gap-2" aria-label="Suggestions">
                {insightsSuggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="ghost"
                    size="sm"
                    className="glass rounded-full font-normal text-foreground/80 hover:bg-background/60 hover:text-foreground"
                    onClick={() => send(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <AIConversation
            className="flex-1"
            contentKey={JSON.stringify(turns.map((t) => (t.from === 'agent' ? `${t.status}${Object.keys(t.spec?.elements ?? {}).length}` : t.id)))}
          >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
              {turns.map((turn) =>
                turn.from === 'user' ? (
                  <AIMessage key={turn.id} from="user" copyText={turn.text}>
                    <p className="whitespace-pre-wrap">{turn.text}</p>
                  </AIMessage>
                ) : (
                  <InsightsAnswer key={turn.id} turn={turn} />
                ),
              )}
            </div>
          </AIConversation>
          <div className="mx-auto w-full max-w-4xl px-4 pb-4">{composer()}</div>
        </>
      )}
    </div>
  )
}

function InsightsAnswer({ turn }: { turn: InsightsAgentTurn }) {
  const state: AIState = turn.status === 'thinking' ? 'thinking' : turn.status === 'streaming' ? 'streaming' : 'done'
  return (
    <AIMessage from="assistant" bubble={false} avatar={<AIOrbFace size={28} state={state} gaze={false} />}>
      <div className="flex min-w-0 flex-col gap-4">
        {(turn.status === 'thinking' || turn.tasks.some((task) => task.status === 'failed')) && <AITaskList label="Analyse" tasks={turn.tasks} />}
        {turn.text && <Markdown>{turn.text}</Markdown>}
        <GenerativeUI spec={turn.spec} loading={turn.status !== 'done'} />
      </div>
    </AIMessage>
  )
}
