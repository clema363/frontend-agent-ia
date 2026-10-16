// Stand in for OpenCode in the mock: replay a canned answer part by part
// so the chat streams like the real session behind the backend.
import type { OpencodeMessage, OpencodePart, OpencodeStepId, UserStory } from '@/lib/domain'

type WithoutIds<Part> = Part extends OpencodePart ? Omit<Part, 'id' | 'sessionID' | 'messageID'> : never
type PartBody = WithoutIds<OpencodePart>

// Reveal one part, or a few words of text, per tick.
const TICK = 350

let counter = 0
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${++counter}`
const timers = new Map<string, number[]>()

function message(sessionID: string, role: 'user' | 'assistant', agent: string): OpencodeMessage {
  const info: OpencodeMessage['info'] = { id: newId('msg'), sessionID, role, agent, time: { created: Date.now() } }
  if (role === 'assistant') Object.assign(info, { providerID: 'anthropic', modelID: 'claude-sonnet-4-5', path: { cwd: '/workspace/cashgpt', root: '/workspace/cashgpt' } })
  return { info, parts: [] }
}

function addPart(target: OpencodeMessage, body: PartBody) {
  const part = { id: newId('prt'), sessionID: target.info.sessionID, messageID: target.info.id, ...body } as OpencodePart
  target.parts.push(part)
  return part
}

type Prompt = { text: string; agent: 'plan' | 'build'; step?: OpencodeStepId; script: PartBody[]; onDone?: () => void }

export function runOpencode(item: UserStory, messages: OpencodeMessage[], prompt: Prompt) {
  item.opencode ??= { sessionId: newId('ses'), steps: {} }
  const sessionID = item.opencode.sessionId
  const user = message(sessionID, 'user', prompt.agent)
  addPart(user, { type: 'text', text: prompt.text })
  if (prompt.step) item.opencode.steps[prompt.step] = user.info.id
  const reply = message(sessionID, 'assistant', prompt.agent)
  messages.push(user, reply)

  // Each step mutates the reply in place; the next GET returns the new state.
  const steps: (() => void)[] = []
  for (const body of prompt.script) {
    if (body.type === 'text') {
      steps.push(() => addPart(reply, { ...body, text: '' }))
      const words = body.text.split(/(?<=\s)/)
      for (let index = 0; index < words.length; index += 6) {
        const chunk = words.slice(index, index + 6).join('')
        steps.push(() => {
          const part = reply.parts.at(-1)
          if (part?.type === 'text') part.text += chunk
        })
      }
    } else if (body.type === 'tool') {
      steps.push(() => addPart(reply, { ...body, state: { status: 'running', input: body.state.input, title: body.state.title, time: { start: Date.now() } } }))
      steps.push(() => {
        const part = reply.parts.at(-1)
        if (part?.type === 'tool') part.state = { ...body.state, time: { start: part.state.time?.start ?? Date.now(), end: Date.now() } }
      })
    } else {
      steps.push(() => addPart(reply, body))
    }
  }
  steps.push(() => {
    reply.info.time.completed = Date.now()
    reply.info.tokens = { input: 12400, output: 860, reasoning: 0, cache: { read: 0, write: 0 } }
    reply.info.cost = 0.04
    timers.delete(item.id)
    prompt.onDone?.()
  })

  stopOpencode(item.id)
  timers.set(item.id, steps.map((step, index) => window.setTimeout(step, (index + 1) * TICK)))
}

// POST /session/{id}/abort: the open answer ends with an aborted error.
export function abortOpencode(item: UserStory, messages: OpencodeMessage[]) {
  stopOpencode(item.id)
  const last = messages.at(-1)
  if (last?.info.role === 'assistant' && !last.info.time.completed) {
    last.info.time.completed = Date.now()
    last.info.error = { name: 'MessageAbortedError', data: { message: 'Aborted' } }
  }
}

function stopOpencode(storyId: string) {
  for (const timer of timers.get(storyId) ?? []) window.clearTimeout(timer)
  timers.delete(storyId)
}

const tool = (name: string, input: Record<string, unknown>, title: string, output: string, metadata: Record<string, unknown> = {}): PartBody => ({
  type: 'tool',
  callID: newId('call'),
  tool: name,
  state: { status: 'completed', input, title, output, metadata },
})
const reasoning = (text: string): PartBody => ({ type: 'reasoning', text, time: { start: Date.now() } })

export function planScript(item: UserStory, plan: string): PartBody[] {
  return [
    reasoning(`I need to understand where "${item.title}" lives in the code before proposing steps.`),
    tool('glob', { pattern: 'src/**/*.{ts,tsx}' }, 'src/**/*.{ts,tsx}', 'src/api/journal.ts\nsrc/pages/journal.tsx\nsrc/studio/charts.tsx'),
    tool('read', { filePath: '/workspace/cashgpt/src/api/journal.ts' }, 'src/api/journal.ts', '<file>\n00001| export async function listJournal(params: { page?: number; size?: number }) {\n</file>'),
    { type: 'text', text: plan },
  ]
}

export function replyScript(text: string): PartBody[] {
  return [
    reasoning(`The user asks: "${text}". I should check the related code before answering.`),
    tool('grep', { pattern: 'listJournal', path: 'src' }, 'listJournal', 'Found 2 matches\nsrc/pages/journal.tsx:\n  Line 18:   const lines = await listJournal({ size: 100000 })'),
    { type: 'text', text: `Mock reply from OpenCode about **"${text}"**. The real session answers here, with the same tool calls and Markdown.` },
  ]
}

export function codingScript(branch: string): PartBody[] {
  return [
    tool('todowrite', { todos: [
      { id: '1', content: 'Apply the plan', status: 'completed', priority: 'high' },
      { id: '2', content: 'Run the tests', status: 'completed', priority: 'medium' },
      { id: '3', content: 'Open the merge request', status: 'completed', priority: 'medium' },
    ] }, '3 todos', ''),
    tool('bash', { command: `git checkout -b ${branch}`, description: 'Create the feature branch' }, 'Create the feature branch', `Switched to a new branch '${branch}'`),
    tool('edit', { filePath: '/workspace/cashgpt/src/api/journal.ts' }, 'src/api/journal.ts', '', {
      diff: '--- src/api/journal.ts\n+++ src/api/journal.ts\n@@ -1,3 +1,3 @@\n-export async function listJournal(params: { page?: number; size?: number }) {\n+export async function listJournal(params: { page?: number; size?: number; sort?: string }) {\n   const search = new URLSearchParams()\n',
    }),
    tool('bash', { command: 'npm test', description: 'Run the tests' }, 'Run the tests', ' Test Files  6 passed (6)\n      Tests  112 passed (112)'),
    { type: 'patch', hash: 'b3e91f0', files: ['src/api/journal.ts'] },
    { type: 'text', text: 'The plan is implemented and the tests pass. I pushed the branch and opened a merge request; the pipeline is running.' },
  ]
}
