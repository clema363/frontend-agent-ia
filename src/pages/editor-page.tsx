import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useId,
  useState,
  type ReactNode,
} from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  ArrowUpRight,
  ChevronRight,
  Code2,
  Files,
  GitBranch,
  GitCompareArrows,
  GitMerge,
  RotateCcw,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useStories } from '@/api/hooks'
import {
  EditorSidebar,
  FileExplorer,
  FileIcon,
  FileRow,
} from '@/components/editor/file-explorer'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  demoWorkspace,
  fileLanguage,
  readWorkspaceDraft,
  workspaceStorageKey,
  type WorkspaceDraft,
} from '@/lib/editor-workspace'
import type { UserStory } from '@/lib/domain'
import { cn } from '@/lib/utils'

const CodeEditor = lazy(() => import('@/components/editor/code-editor'))
const CodeDiff = lazy(() => import('@/components/editor/code-diff'))

export function EditorPage() {
  const { data: stories = [], isLoading, isError, refetch } = useStories()
  const [params, setParams] = useSearchParams()
  const selected = params.get('us')
  const story = selected
    ? stories.find((item) => item.id === selected)
    : (stories.find((item) => item.column === 'coding') ?? stories[0])
  const picker = (
    <Select
      items={stories.map((item) => ({
        value: item.id,
        label: `${item.key} · ${item.title}`,
      }))}
      value={story?.id ?? null}
      disabled={isLoading || isError}
      onValueChange={(value) => value && setParams({ us: value })}
    >
      <SelectTrigger
        size="sm"
        aria-label="User story workspace"
        className="min-w-0 max-w-72 border-transparent bg-transparent text-sm font-medium shadow-none hover:bg-accent/60 dark:bg-transparent"
      >
        <SelectValue
          placeholder={isLoading ? 'Loading stories…' : 'Select a user story'}
        />
      </SelectTrigger>
      <SelectContent>
        {stories.map((item) => (
          <SelectItem key={item.id} value={item.id} className="text-xs">
            {item.key} · {item.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  return (
    <>
      <PageHeader
        title="Editor"
        icon={Code2}
        actions={
          story && (
            <Button
              aria-label="Open issue"
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link to={`/kanban/${story.id}`} />}
            >
              <span className="hidden sm:inline">Open issue</span>
              <ArrowUpRight />
            </Button>
          )
        }
      />
      <div className="flex min-h-0 flex-1 flex-col">
        {story ? (
          <StoryWorkspace key={story.id} story={story} picker={picker} />
        ) : (
          <>
            <WorkspaceHeader picker={picker} />
            {isLoading ? (
              <p className="p-8 text-sm text-muted-foreground">
                Loading workspace…
              </p>
            ) : isError ? (
              <div className="p-8">
                <p className="mb-3 text-sm">Unable to load user stories.</p>
                <Button variant="outline" onClick={() => void refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <div className="p-8 text-sm text-muted-foreground">
                {selected
                  ? 'This user story was not found. Select another story above.'
                  : 'Create a user story in Kanban to open its workspace.'}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

function WorkspaceHeader({
  picker,
  branch,
  actions,
}: {
  picker: ReactNode
  branch?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2">
      {picker}
      {branch && (
        <span
          className="hidden min-w-0 items-center gap-1 truncate text-xs text-muted-foreground/70 sm:flex"
          title={branch}
        >
          <GitBranch className="size-3 shrink-0" />
          <span className="truncate font-mono">{branch}</span>
        </span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <span
          title="Demo files. Edits stay in this browser. Repository access, commits and merging require the workspace API."
          className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
          Demo
        </span>
        {actions}
      </div>
    </div>
  )
}

function ActivityBarButton({
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  label: string
  icon: LucideIcon
  active: boolean
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        'relative flex h-12 w-full items-center justify-center text-muted-foreground/70 transition-colors hover:bg-accent/60 hover:text-foreground',
        active && 'bg-accent text-foreground',
      )}
    >
      <Icon className="size-5" strokeWidth={1.6} />
      {Boolean(badge) && (
        <span className="absolute top-2 right-2 min-w-3.5 rounded-full bg-primary px-1 text-[9px] leading-3.5 font-medium text-primary-foreground tabular-nums">
          {badge}
        </span>
      )}
    </button>
  )
}

function DiffStat({ before, after }: { before: string; after: string }) {
  const counts = new Map<string, number>()
  for (const line of before.split('\n'))
    counts.set(line, (counts.get(line) ?? 0) + 1)
  let additions = 0
  for (const line of after.split('\n')) {
    const left = counts.get(line) ?? 0
    if (left) counts.set(line, left - 1)
    else additions++
  }
  const deletions = [...counts.values()].reduce((sum, left) => sum + left, 0)
  return (
    <span className="flex shrink-0 gap-1.5 text-[11px] tabular-nums">
      <span className="text-emerald-600 dark:text-emerald-400">
        +{additions}
      </span>
      <span className="text-red-600 dark:text-red-400">-{deletions}</span>
    </span>
  )
}

function StoryWorkspace({
  story,
  picker,
}: {
  story: UserStory
  picker: ReactNode
}) {
  const files = useMemo(() => demoWorkspace(story), [story])
  const [local, setLocal] = useState(() => readWorkspaceDraft(story.id))
  const editorScope = useId()
  const [fileRevisions, setFileRevisions] = useState<Record<string, number>>({})
  const [active, setActive] = useState<string | undefined>('README.md')
  const [mode, setMode] = useState<'files' | 'changes'>('files')
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [sidebar, setSidebar] = useState(true)
  const [review, setReview] = useState(false)
  const [resetPath, setResetPath] = useState<string>()
  const [storageError, setStorageError] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const file = files.find((item) => item.path === active)
  const content = (path: string) =>
    local.drafts[path] ??
    files.find((item) => item.path === path)?.content ??
    ''
  const modifiedFiles = files.filter(
    (item) => content(item.path) !== item.content,
  )
  const modified = new Set(modifiedFiles.map((item) => item.path))
  const unsaved = files.filter(
    (item) => content(item.path) !== (local.saved[item.path] ?? item.content),
  )
  const value = file ? content(file.path) : ''
  const dirty = file ? unsaved.includes(file) : false
  const matches = files.filter((item) =>
    item.path.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const branch =
    story.codingAgent?.branch ?? `workspace/${story.key.toLowerCase()}`

  const persist = useCallback(
    (next: WorkspaceDraft) => {
      setLocal(next)
      try {
        localStorage.setItem(
          workspaceStorageKey(story.id),
          JSON.stringify(next),
        )
        setStorageError(false)
      } catch {
        setStorageError(true)
      }
    },
    [story.id],
  )

  const save = useCallback(
    () => persist({ ...local, saved: { ...local.drafts } }),
    [local, persist],
  )
  function open(path: string) {
    setActive(path)
    setCursor({ line: 1, column: 1 })
  }
  // Re-selecting the active activity item collapses the sidebar (VS Code style).
  function selectActivity(item: 'files' | 'changes' | 'search') {
    const current = searching ? 'search' : mode
    if (sidebar && current === item) return setSidebar(false)
    setSidebar(true)
    setSearching(item === 'search')
    if (item !== 'search') setMode(item)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  const segments = file ? [story.key, ...file.path.split('/')] : []

  return (
    <>
      <WorkspaceHeader
        picker={picker}
        branch={branch}
        actions={
          <Button
            aria-label="Review & merge"
            variant="outline"
            size="sm"
            onClick={() => setReview(true)}
          >
            <GitMerge />
            <span className="hidden sm:inline">Review & merge</span>
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <nav
          aria-label="Editor activity bar"
          className="flex w-12 shrink-0 flex-col items-center border-r bg-background"
        >
          <ActivityBarButton
            label="Files"
            icon={Files}
            active={sidebar && !searching && mode === 'files'}
            onClick={() => selectActivity('files')}
          />
          <ActivityBarButton
            label="Changes"
            icon={GitCompareArrows}
            badge={modified.size}
            active={sidebar && !searching && mode === 'changes'}
            onClick={() => selectActivity('changes')}
          />
          <ActivityBarButton
            label="Search files"
            icon={Search}
            active={sidebar && searching}
            onClick={() => selectActivity('search')}
          />
        </nav>
        {sidebar &&
          (searching ? (
            <EditorSidebar label="Search files" icon={Search} title="Search">
              <div className="border-b p-2">
                <input
                  aria-label="Find a file"
                  placeholder="Find a file…"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setQuery('')
                    if (event.key === 'Enter' && matches[0])
                      open(matches[0].path)
                  }}
                  className="h-7 w-full rounded-md border bg-muted/40 px-2 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-ring"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-1">
                {matches.map((item) => (
                  <FileRow
                    key={item.path}
                    path={item.path}
                    selected={active === item.path}
                    onOpen={open}
                  />
                ))}
                {!matches.length && (
                  <p
                    role="status"
                    className="px-2 py-6 text-center text-xs text-muted-foreground"
                  >
                    No matching files.
                  </p>
                )}
              </div>
            </EditorSidebar>
          ) : mode === 'changes' ? (
            <EditorSidebar
              label="Changed files"
              icon={GitCompareArrows}
              title="Changed files"
              meta={
                modified.size > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                    {modified.size}
                  </span>
                )
              }
            >
              <div className="min-h-0 flex-1 overflow-auto p-1">
                {modifiedFiles.map((item) => (
                  <FileRow
                    key={item.path}
                    path={item.path}
                    selected={active === item.path}
                    onOpen={open}
                    trailing={
                      <DiffStat
                        before={item.content}
                        after={content(item.path)}
                      />
                    }
                  />
                ))}
                {!modified.size && (
                  <p className="px-3 py-6 text-center text-xs leading-5 text-muted-foreground">
                    No changes yet. Edit a file to see its diff here.
                  </p>
                )}
              </div>
            </EditorSidebar>
          ) : (
            <FileExplorer
              files={files}
              active={active}
              modified={modified}
              storyKey={story.key}
              onOpen={open}
            />
          ))}
        <section
          aria-label="File editor"
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {file ? (
            <>
              <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
                <nav
                  aria-label="File path"
                  className="flex min-w-0 flex-1 items-center text-xs leading-none"
                >
                  <span className="flex min-w-0 shrink-[9999] items-center overflow-hidden">
                    {segments.slice(0, -1).map((part, index) => (
                      <span key={index} className="flex min-w-0 items-center">
                        <span className="truncate text-muted-foreground/80">
                          {part}
                        </span>
                        <ChevronRight className="mx-0.5 size-3 shrink-0 text-muted-foreground/40" />
                      </span>
                    ))}
                  </span>
                  <FileIcon path={file.path} className="mr-1.5 size-3.5" />
                  <span
                    className="min-w-0 shrink truncate font-medium text-foreground"
                    title={file.path}
                  >
                    {segments.at(-1)}
                  </span>
                  {dirty && (
                    <span
                      aria-label="Unsaved changes"
                      title="Unsaved changes"
                      className="ml-2 size-1.5 shrink-0 rounded-full bg-primary"
                    />
                  )}
                </nav>
                {mode === 'changes' && (
                  <span className="hidden shrink-0 text-[11px] text-muted-foreground/70 sm:inline">
                    Diff vs. original
                  </span>
                )}
                <span
                  role="status"
                  className={cn(
                    'hidden shrink-0 text-[11px] text-muted-foreground md:inline',
                    storageError && 'inline text-destructive',
                  )}
                >
                  {storageError
                    ? 'Browser storage unavailable'
                    : unsaved.length
                      ? `${unsaved.length} unsaved`
                      : 'Saved'}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {modified.has(file.path) && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground"
                      aria-label="Discard file changes"
                      title="Discard file changes"
                      onClick={() => setResetPath(file.path)}
                    >
                      <RotateCcw />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={!unsaved.length && !storageError}
                    onClick={save}
                  >
                    Save
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="text-muted-foreground"
                    aria-label={`Close ${file.path}`}
                    title="Close editor"
                    onClick={() => setActive(undefined)}
                  >
                    <X />
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {mode === 'changes' ? (
                  <Suspense
                    fallback={
                      <p className="p-6 text-xs text-muted-foreground">
                        Loading diff…
                      </p>
                    }
                  >
                    <CodeDiff
                      path={file.path}
                      before={file.content}
                      after={value}
                    />
                  </Suspense>
                ) : (
                  <Suspense
                    fallback={
                      <p className="p-6 text-xs text-muted-foreground">
                        Loading editor…
                      </p>
                    }
                  >
                    <CodeEditor
                      key={`${file.path}:${fileRevisions[file.path] ?? 0}`}
                      stateKey={`${story.id}:${editorScope}:${file.path}:${fileRevisions[file.path] ?? 0}`}
                      path={file.path}
                      value={value}
                      onChange={(text) =>
                        persist({
                          ...local,
                          drafts: { ...local.drafts, [file.path]: text },
                        })
                      }
                      onCursor={(line, column) =>
                        setCursor((current) =>
                          current.line === line && current.column === column
                            ? current
                            : { line, column },
                        )
                      }
                    />
                  </Suspense>
                )}
              </div>
              <footer className="flex h-6 shrink-0 items-center gap-4 border-t px-3 text-[10px] text-muted-foreground">
                <span className="truncate">
                  Demo files · edits stay in this browser
                </span>
                <span className="ml-auto shrink-0 tabular-nums">
                  Ln {cursor.line}, Col {cursor.column}
                </span>
                <span className="hidden shrink-0 sm:inline">
                  {fileLanguage(file.path)}
                </span>
              </footer>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <Code2 className="size-8 text-muted-foreground/40" />
              <p className="max-w-xs text-xs leading-5 text-muted-foreground">
                Open a file from the explorer to start editing. Each US groups
                its documents and repositories in one place.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSidebar(true)
                  setSearching(false)
                  setMode('files')
                }}
              >
                Browse files
              </Button>
            </div>
          )}
        </section>
      </div>
      <Dialog open={review} onOpenChange={setReview}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review changes · {story.key}</DialogTitle>
            <DialogDescription>
              {modified.size} changed file{modified.size === 1 ? '' : 's'}{' '}
              across this demo workspace. These changes have not been committed
              or pushed.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 space-y-2 overflow-auto">
            {modifiedFiles.map((item) => (
              <button
                key={item.path}
                className="flex w-full items-center gap-2 rounded-md border p-3 text-left text-xs hover:bg-accent"
                onClick={() => {
                  open(item.path)
                  setSidebar(true)
                  setSearching(false)
                  setMode('changes')
                  setReview(false)
                }}
              >
                <FileIcon path={item.path} />
                <span className="truncate">{item.path}</span>
                <GitCompareArrows className="ml-auto size-4 shrink-0" />
              </button>
            ))}
            {!modified.size && (
              <p className="py-3 text-sm text-muted-foreground">
                No local changes to review.
              </p>
            )}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Each repository needs its own merge request. Local demo edits are
            separate from the existing merge request. Saving here does not
            update GitLab.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(false)}>
              Continue editing
            </Button>
            {story.codingAgent?.pullRequest ? (
              <Button
                nativeButton={false}
                render={
                  <a
                    href={story.codingAgent.pullRequest.url}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <GitMerge />
                Open existing MR #{story.codingAgent.pullRequest.number}
                <ArrowUpRight />
              </Button>
            ) : (
              <Button disabled>
                <GitMerge />
                No merge request available
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(resetPath)}
        onOpenChange={(open) => {
          if (!open) setResetPath(undefined)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              Restore {resetPath} to its demo original. Both the draft and the
              locally saved changes to this file will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPath(undefined)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (resetPath) {
                  const drafts = { ...local.drafts }
                  const saved = { ...local.saved }
                  delete drafts[resetPath]
                  delete saved[resetPath]
                  persist({ drafts, saved })
                  setFileRevisions((current) => ({
                    ...current,
                    [resetPath]: (current[resetPath] ?? 0) + 1,
                  }))
                }
                setResetPath(undefined)
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
