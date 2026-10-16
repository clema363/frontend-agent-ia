// Read the story's OpenCode session: steps, plan versions, todos and changed files.
import { opencodeSteps, type OpencodeMessage, type OpencodePart, type OpencodeStepId, type UserStory } from '@/lib/domain'

export type ToolPart = Extract<OpencodePart, { type: 'tool' }>

// Messages of one step: from its first message to the start of the next step.
export function splitBySteps(messages: OpencodeMessage[], session: UserStory['opencode']) {
  const bySteps = new Map<OpencodeStepId, OpencodeMessage[]>()
  let step: OpencodeStepId = 'plan'
  for (const message of messages) {
    const started = opencodeSteps.find((item) => session?.steps[item.id] === message.info.id)
    if (started) step = started.id
    bySteps.set(step, [...(bySteps.get(step) ?? []), message])
  }
  return bySteps
}

// The plan prompt asks OpenCode to start its plan with this heading; text before it is commentary.
const PLAN_HEADING = /^## Implementation plan\b/m

export function splitPlan(text: string): { intro: string; plan?: string } {
  const match = PLAN_HEADING.exec(text)
  if (!match) return { intro: text }
  return { intro: text.slice(0, match.index).trim(), plan: text.slice(match.index).trim() }
}

// Each finished plan-agent answer that contains a plan is a version; the last one is up for approval.
export function planVersions(messages: OpencodeMessage[], session: UserStory['opencode']) {
  const planMessages = splitBySteps(messages, session).get('plan') ?? []
  return planMessages
    .filter((message) => message.info.role === 'assistant' && message.info.time.completed && !message.info.error)
    .filter((message) => message.parts.some((part) => part.type === 'text' && splitPlan(part.text).plan))
    .map((message, index) => ({ messageId: message.info.id, version: index + 1 }))
}

export const planAnchor = (messageId: string) => `plan-${messageId}`

const toolParts = (messages: OpencodeMessage[]) =>
  messages.flatMap((message) => message.parts.filter((part): part is ToolPart => part.type === 'tool'))

export type Todo = { id: string; content: string; status: string }

// Latest todo list written by OpenCode (todowrite replaces the whole list).
export function latestTodos(messages: OpencodeMessage[]): Todo[] {
  const last = toolParts(messages).findLast((part) => part.tool === 'todowrite' && Array.isArray(part.state.input.todos))
  return (last?.state.input.todos as Todo[] | undefined) ?? []
}

// Files written by edit/write calls and patches, relative to the repository root.
export function changedFiles(messages: OpencodeMessage[]) {
  const files = new Set<string>()
  for (const message of messages) {
    const root = message.info.path?.root
    for (const part of message.parts) {
      if (part.type === 'patch') part.files.forEach((file) => files.add(file))
      if (part.type === 'tool' && (part.tool === 'edit' || part.tool === 'write') && part.state.status === 'completed') {
        const path = part.state.input.filePath
        if (typeof path === 'string') files.add(root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path)
      }
    }
  }
  return [...files]
}
