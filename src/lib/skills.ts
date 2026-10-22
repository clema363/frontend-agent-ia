import { useSyncExternalStore } from 'react'

// UI only for now: skills live in memory until the backend exposes them.
// Kept in a module store so the Skills tab and the skill page share the same list.

export type Skill = {
  id: string
  name: string
  description: string
  instructions: string
  enabled: boolean
  source: 'ai' | 'manual'
  updatedAt: string
}

export type SkillDraft = Pick<Skill, 'name' | 'description' | 'instructions' | 'enabled'>

export const emptySkillDraft: SkillDraft = { name: '', description: '', instructions: '', enabled: true }

const seedSkills: Skill[] = [
  {
    id: 'skill-gherkin',
    name: 'gherkin-acceptance-criteria',
    description: 'Write acceptance criteria as Given / When / Then scenarios, one per business rule.',
    instructions:
      '# Gherkin acceptance criteria\n\n- One scenario per business rule.\n- Use the vocabulary of the context maps.\n- Cover at least one error case.',
    enabled: true,
    source: 'manual',
    updatedAt: '2026-10-20T09:12:00Z',
  },
  {
    id: 'skill-api-conventions',
    name: 'api-conventions',
    description: 'Follow the REST naming, pagination and error format used by the project API.',
    instructions:
      '# API conventions\n\n- Plural resource names in kebab-case.\n- Cursor pagination with `next` and `limit`.\n- Errors follow RFC 9457 (problem+json).',
    enabled: false,
    source: 'ai',
    updatedAt: '2026-10-21T15:40:00Z',
  },
]

const skillsByProject = new Map<string, Skill[]>()
const listeners = new Set<() => void>()

function read(projectId: string) {
  if (!skillsByProject.has(projectId)) skillsByProject.set(projectId, seedSkills)
  return skillsByProject.get(projectId)!
}

function write(projectId: string, update: (list: Skill[]) => Skill[]) {
  skillsByProject.set(projectId, update(read(projectId)))
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSkills(projectId: string) {
  const skills = useSyncExternalStore(subscribe, () => read(projectId))
  const now = () => new Date().toISOString()

  return {
    skills,
    create(draft: SkillDraft, source: Skill['source']) {
      const skill: Skill = { ...draft, id: crypto.randomUUID(), source, updatedAt: now() }
      write(projectId, (list) => [...list, skill])
      return skill
    },
    update(id: string, patch: Partial<SkillDraft>) {
      write(projectId, (list) => list.map((skill) => (skill.id === id ? { ...skill, ...patch, updatedAt: now() } : skill)))
    },
    remove(id: string) {
      write(projectId, (list) => list.filter((skill) => skill.id !== id))
    },
  }
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '')
}

// Placeholders for the generation endpoint: build plausible drafts from the prompt.

export function draftFromPrompt(prompt: string): SkillDraft {
  const summary = prompt.trim().replace(/\s+/g, ' ')
  const name = slugify(summary.split(' ').slice(0, 4).join('-')).replace(/-+$/, '')
  return {
    name: name || 'new-skill',
    description: summary,
    enabled: true,
    instructions: `# ${summary}\n\n## When to apply\n\n- Whenever a user story touches this topic.\n\n## Rules\n\n- ${summary}.\n- Reuse the vocabulary of the project context maps.\n- Flag any ambiguity in the open questions section.`,
  }
}

export function refineInstructions(instructions: string, prompt: string) {
  const rule = `- ${prompt.trim().replace(/\s+/g, ' ').replace(/\.$/, '')}.`
  return instructions.includes('## Rules')
    ? instructions.replace(/(## Rules\n\n(?:- .*\n?)*)/, (rules) => `${rules.trimEnd()}\n${rule}\n`).trimEnd()
    : `${instructions.trimEnd()}\n\n## Rules\n\n${rule}`.trimStart()
}

export const skillTemplates: { label: string; draft: SkillDraft }[] = [
  {
    label: 'Writing conventions',
    draft: {
      ...emptySkillDraft,
      name: 'writing-conventions',
      description: 'Tone, vocabulary and structure the agents follow when they write user stories.',
      instructions: '# Writing conventions\n\n## When to apply\n\n- Every time a user story is written or rewritten.\n\n## Rules\n\n- \n\n## Examples\n\n',
    },
  },
  {
    label: 'Code conventions',
    draft: {
      ...emptySkillDraft,
      name: 'code-conventions',
      description: 'Patterns OpenCode follows when it implements a user story in the repository.',
      instructions: '# Code conventions\n\n## When to apply\n\n- Every time code is generated for a user story.\n\n## Rules\n\n- \n\n## Files to check first\n\n- ',
    },
  },
  {
    label: 'Checklist',
    draft: {
      ...emptySkillDraft,
      name: 'review-checklist',
      description: 'Checks the agents run before handing a user story over.',
      instructions: '# Review checklist\n\nBefore handing the story over, check that:\n\n- [ ] \n- [ ] \n- [ ] ',
    },
  },
]
