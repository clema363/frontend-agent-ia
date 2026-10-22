import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useId,
  useState,
} from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  Files,
  GitBranch,
  GitCompareArrows,
  GitMerge,
  RotateCcw,
  Save,
  X,
} from 'lucide-react'
import { useStories } from '@/api/hooks'
import { FileExplorer, FileIcon } from '@/components/editor/file-explorer'
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
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Files className="size-4 text-muted-foreground" />
            Workspace
          </span>
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
              className="min-w-0 max-w-full flex-1 text-xs sm:max-w-96"
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
          <span
            title="Demo files. Edits stay in this browser. Repository access, commits and merging require the workspace API."
            className="rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-700 sm:ml-auto dark:text-amber-400"
          >
            DEMO WORKSPACE
          </span>
        </div>
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
        ) : story ? (
          <StoryWorkspace key={story.id} story={story} />
        ) : (
          <div className="p-8 text-sm text-muted-foreground">
            {selected
              ? 'This user story was not found. Select another story above.'
              : 'Create a user story in Kanban to open its workspace.'}
          </div>
        )}
      </div>
    </>
  )
}

function StoryWorkspace({ story }: { story: UserStory }) {
  const files = useMemo(() => demoWorkspace(story), [story])
  const [local, setLocal] = useState(() => readWorkspaceDraft(story.id))
  const editorScope = useId()
  const [fileRevisions, setFileRevisions] = useState<Record<string, number>>({})
  const [tabs, setTabs] = useState(['README.md'])
  const [active, setActive] = useState<string | undefined>('README.md')
  const [view, setView] = useState<'files' | 'changes'>('files')
  const [review, setReview] = useState(false)
  const [resetPath, setResetPath] = useState<string>()
  const [explorer, setExplorer] = useState(true)
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
    setTabs((current) =>
      current.includes(path) ? current : [...current, path],
    )
    setCursor({ line: 1, column: 1 })
  }
  function close(path: string) {
    const next = tabs.filter((tab) => tab !== path)
    setTabs(next)
    if (active === path) setActive(next.at(-1))
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

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/15 px-4 py-2">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Toggle file explorer"
          aria-pressed={explorer}
          onClick={() => setExplorer(!explorer)}
        >
          <Files />
        </Button>
        <GitBranch className="size-3.5 text-muted-foreground" />
        <span
          className="max-w-56 truncate font-mono text-[11px] text-muted-foreground"
          title={story.codingAgent?.branch}
        >
          {story.codingAgent?.branch ?? `workspace/${story.key.toLowerCase()}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={view === 'changes' ? 'secondary' : 'ghost'}
            aria-label={`Changes ${modified.size}`}
            aria-pressed={view === 'changes'}
            size="sm"
            onClick={() => setView(view === 'files' ? 'changes' : 'files')}
          >
            <GitCompareArrows />
            <span className="hidden sm:inline">Changes</span>
            <span className="rounded bg-muted px-1.5 text-[10px]">
              {modified.size}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!unsaved.length && !storageError}
            aria-label="Save locally"
            onClick={save}
          >
            <Save />
            <span className="hidden sm:inline">Save locally</span>
          </Button>
          <Button
            aria-label="Review & merge"
            size="sm"
            onClick={() => setReview(true)}
          >
            <GitMerge />
            <span className="hidden sm:inline">Review & merge</span>
          </Button>
        </div>
      </div>
      <div
        className={cn(
          'grid min-h-0 flex-1',
          explorer
            ? 'grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)]'
            : 'grid-cols-1',
        )}
      >
        {explorer &&
          (view === 'files' ? (
            <FileExplorer
              files={files}
              active={active}
              modified={modified}
              storyKey={story.key}
              onOpen={open}
            />
          ) : (
            <aside
              aria-label="Changed files"
              className="overflow-auto border-r bg-muted/25"
            >
              <div className="flex h-11 items-center px-4 text-[11px] font-semibold tracking-widest text-muted-foreground">
                SOURCE CONTROL
              </div>
              <p className="px-4 pb-4 text-xs text-muted-foreground">
                Compared with demo originals
              </p>
              {modifiedFiles.map((item) => (
                <button
                  key={item.path}
                  onClick={() => open(item.path)}
                  className={cn(
                    'flex w-full items-center gap-2 px-4 py-2 text-left text-xs hover:bg-accent',
                    active === item.path && 'bg-primary/10',
                  )}
                >
                  <FileIcon path={item.path} />
                  <span className="min-w-0 flex-1 truncate" title={item.path}>
                    {item.path}
                  </span>
                  <span className="text-amber-600">M</span>
                </button>
              ))}
              {!modified.size && (
                <p className="px-4 text-xs text-muted-foreground">
                  No changes yet. Edit a file to see its diff here.
                </p>
              )}
              <Button
                className="m-3"
                variant="ghost"
                size="sm"
                onClick={() => setView('files')}
              >
                <ArrowLeft />
                Explorer
              </Button>
            </aside>
          ))}
        <section
          aria-label="File editor"
          className="flex min-h-0 min-w-0 flex-col"
        >
          <div
            aria-label="Open files"
            className="flex h-10 shrink-0 overflow-x-auto border-b bg-muted/20"
          >
            {tabs.map((path) => (
              <div
                key={path}
                className={cn(
                  'flex shrink-0 items-center border-r border-t-2 border-t-transparent text-xs',
                  active === path && 'border-t-primary bg-background',
                )}
              >
                <button
                  onClick={() => open(path)}
                  aria-pressed={active === path}
                  title={path}
                  className="flex h-full items-center gap-2 pr-2 pl-3"
                >
                  <FileIcon path={path} />
                  {path.split('/').at(-1)}
                  {content(path) !==
                    (local.saved[path] ??
                      files.find((item) => item.path === path)?.content) && (
                    <span
                      aria-label="Unsaved changes"
                      className="size-1.5 rounded-full bg-amber-500"
                    />
                  )}
                </button>
                <button
                  onClick={() => close(path)}
                  title={`Close ${path}`}
                  aria-label={`Close ${path}`}
                  className="mr-1 rounded p-1 hover:bg-accent"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
          {file ? (
            <>
              <div className="flex min-h-9 shrink-0 items-center gap-1 overflow-hidden border-b px-4 text-[11px] text-muted-foreground">
                <span className="shrink-0">{story.key}</span>
                {file.path.split('/').map((part, index) => (
                  <span key={index} className="flex min-w-0 items-center gap-1">
                    <ChevronRight className="size-3 shrink-0" />
                    <span className="truncate">{part}</span>
                  </span>
                ))}
                {modified.has(file.path) && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="ml-auto shrink-0"
                    aria-label="Discard file changes"
                    title="Discard file changes"
                    onClick={() => setResetPath(file.path)}
                  >
                    <RotateCcw />
                  </Button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {view === 'changes' ? (
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
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <Code2 className="size-10 text-muted-foreground/40" />
              <h2 className="text-sm font-medium">
                Your story, your workspace
              </h2>
              <p className="max-w-xs text-xs leading-5 text-muted-foreground">
                Open a file from the explorer to start editing. Each US groups
                its documents and repositories in one place.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExplorer(true)
                  setView('files')
                }}
              >
                Browse files
              </Button>
            </div>
          )}
        </section>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
        <span
          role="status"
          className={cn(
            'flex items-center gap-1.5',
            storageError && 'text-destructive',
          )}
        >
          {storageError ? (
            'Browser storage unavailable. Keep this page open to retain edits.'
          ) : (
            <>
              <Check className="size-3 text-emerald-600" />
              {unsaved.length
                ? `${unsaved.length} unsaved · drafts kept locally`
                : 'Saved in this browser'}
            </>
          )}
        </span>
        <span className="ml-auto">
          {file && `Ln ${cursor.line}, Col ${cursor.column}`}
        </span>
        {file && (
          <span className="hidden sm:inline">{fileLanguage(file.path)}</span>
        )}
        <span className="hidden sm:inline">UTF-8</span>
        <span className="hidden md:inline">
          Demo files · no repository access yet
        </span>
      </footer>
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
                  setView('changes')
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
