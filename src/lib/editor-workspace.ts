import type { UserStory } from '@/lib/domain'

export type WorkspaceFile = { path: string; content: string }
export type WorkspaceDraft = {
  drafts: Record<string, string>
  saved: Record<string, string>
}

// Sample repositories only. Replace this adapter with the story workspace API.
export function demoWorkspace(story: UserStory): WorkspaceFile[] {
  return [
    {
      path: 'README.md',
      content: `# ${story.key} — ${story.title}\n\n${story.raw}\n\n## Workspace\n\nThis is a demonstration workspace.\nEach repository has its own branch and merge request.\nEdits are stored in this browser only.\n`,
    },
    ...Object.entries(story.stages).map(([stage, output]) => ({
      path: `documents/${stage}.md`,
      content: output.markdown,
    })),
    {
      path: 'frontend/src/pages/journal.tsx',
      content: `import { useState } from 'react'\nimport { getJournal } from '../api/journal'\n\nexport function JournalPage() {\n  const [counterparty, setCounterparty] = useState('')\n\n  async function applyFilters() {\n    return getJournal({ counterparty })\n  }\n\n  return (\n    <section>\n      <h1>Journal</h1>\n      <input\n        aria-label="Counterparty"\n        value={counterparty}\n        onChange={(event) => setCounterparty(event.target.value)}\n      />\n      <button onClick={applyFilters}>Apply filters</button>\n    </section>\n  )\n}\n`,
    },
    {
      path: 'frontend/src/api/journal.ts',
      content: `export type JournalFilters = {\n  counterparty?: string\n  page?: number\n}\n\nexport async function getJournal(filters: JournalFilters) {\n  const params = new URLSearchParams()\n  if (filters.counterparty) {\n    params.set('counterparty', filters.counterparty)\n  }\n  params.set('page', String(filters.page ?? 1))\n\n  const response = await fetch('/api/journal?' + params)\n  if (!response.ok) throw new Error('Unable to load journal')\n  return response.json()\n}\n`,
    },
    {
      path: 'frontend/package.json',
      content:
        JSON.stringify(
          {
            name: 'demo-frontend',
            private: true,
            scripts: { dev: 'vite', build: 'vite build' },
            dependencies: { react: '^19.0.0' },
          },
          null,
          2,
        ) + '\n',
    },
    {
      path: 'backend/app/routes/journal.py',
      content: `from fastapi import APIRouter\n\nrouter = APIRouter(prefix="/journal")\n\n\n@router.get("")\nasync def list_journal(counterparty: str | None = None, page: int = 1):\n    # Demo endpoint: connect the journal repository here.\n    return {\n        "items": [],\n        "page": page,\n        "counterparty": counterparty,\n    }\n`,
    },
    {
      path: 'backend/tests/test_journal.py',
      content: `def test_journal_filter(client):\n    response = client.get("/journal", params={"counterparty": "Acme"})\n\n    assert response.status_code == 200\n    assert response.json()["counterparty"] == "Acme"\n`,
    },
    {
      path: 'backend/README.md',
      content:
        '# Demo backend\n\nSample API repository assigned to this story.\n\nRun locally:\n\n```sh\nuvicorn app.main:app --reload\n```\n',
    },
  ]
}

export const workspaceStorageKey = (storyId: string) =>
  `atlas-editor:v1:${storyId}`

export function readWorkspaceDraft(storyId: string): WorkspaceDraft {
  try {
    const value = JSON.parse(
      localStorage.getItem(workspaceStorageKey(storyId)) ?? '{}',
    )
    const strings = (record: unknown): Record<string, string> =>
      record && typeof record === 'object' && !Array.isArray(record)
        ? Object.fromEntries(
            Object.entries(record).filter(
              ([, content]) => typeof content === 'string',
            ),
          )
        : {}
    return { drafts: strings(value?.drafts), saved: strings(value?.saved) }
  } catch {
    return { drafts: {}, saved: {} }
  }
}

const languages: Record<string, string> = {
  tsx: 'TypeScript JSX',
  ts: 'TypeScript',
  py: 'Python',
  json: 'JSON',
  md: 'Markdown',
}

export const fileLanguage = (path: string) =>
  languages[path.split('.').at(-1) ?? ''] ?? 'Plain Text'

// Top-level folders other than `documents/` are repositories.
export const workspaceRepositories = (files: WorkspaceFile[]) => [
  ...new Set(
    files
      .map((file) => file.path.split('/'))
      .filter((parts) => parts.length > 1 && parts[0] !== 'documents')
      .map((parts) => parts[0]),
  ),
]
