import { FileTree, useFileTree, useFileTreeSearch } from '@pierre/trees/react'
import { useEffect, useRef, type CSSProperties } from 'react'
import {
  FileCode2,
  FileJson,
  FileText,
  FolderOpen,
  GitBranch,
  Search,
} from 'lucide-react'
import { useEditorAppearance } from '@/hooks/use-editor-appearance'
import {
  workspaceRepositories,
  type WorkspaceFile,
} from '@/lib/editor-workspace'
import { cn } from '@/lib/utils'

export function FileIcon({
  path,
  className,
}: {
  path: string
  className?: string
}) {
  const Icon = path.endsWith('.json')
    ? FileJson
    : path.endsWith('.md')
      ? FileText
      : FileCode2
  return (
    <Icon
      aria-hidden="true"
      className={cn(
        'size-4 shrink-0',
        path.endsWith('.tsx')
          ? 'text-sky-500'
          : path.endsWith('.py')
            ? 'text-amber-500'
            : 'text-muted-foreground',
        className,
      )}
    />
  )
}

const treeStyle = {
  '--trees-bg-override': 'transparent',
  '--trees-fg-override': 'var(--foreground)',
  '--trees-font-family-override': 'var(--font-sans)',
  '--trees-font-size-override': '12px',
  '--trees-hover-bg-override': 'var(--accent)',
  '--trees-selected-bg-override':
    'color-mix(in oklch, var(--primary) 12%, transparent)',
  '--trees-theme-focus-ring': 'var(--primary)',
} as CSSProperties

export function FileExplorer({
  files,
  active,
  modified,
  storyKey,
  onOpen,
}: {
  files: WorkspaceFile[]
  active?: string
  modified: Set<string>
  storyKey: string
  onOpen: (path: string) => void
}) {
  const appearance = useEditorAppearance()
  const repositoryCount = workspaceRepositories(files).length
  const latest = useRef({ onOpen, active, files })
  useEffect(() => {
    latest.current = { onOpen, active, files }
  }, [onOpen, active, files])
  const { model } = useFileTree({
    paths: files.map((file) => file.path),
    initialExpansion: 'open',
    initialSelectedPaths: active ? [active] : [],
    flattenEmptyDirectories: false,
    search: false,
    fileTreeSearchMode: 'hide-non-matches',
    searchBlurBehavior: 'retain',
    density: 'default',
    onSelectionChange(paths) {
      const path = paths.at(-1)
      if (
        path &&
        path !== latest.current.active &&
        latest.current.files.some((file) => file.path === path)
      )
        latest.current.onOpen(path)
    },
  })
  const search = useFileTreeSearch(model)
  const noMatches =
    search.value.trim().length > 0 && search.matchingPaths.length === 0
  useEffect(() => {
    model.setGitStatus(
      [...modified].map((path) => ({ path, status: 'modified' })),
    )
  }, [model, modified])
  useEffect(() => {
    for (const path of model.getSelectedPaths())
      if (path !== active) model.getItem(path)?.deselect()
    if (active) {
      const item = model.getItem(active)
      if (item && !item.isSelected()) item.select()
    }
  }, [active, model])

  return (
    <aside
      aria-label="File explorer"
      className="flex min-h-0 flex-col border-r bg-muted/25"
    >
      <div className="flex h-11 shrink-0 items-center justify-between px-4 text-[11px] font-semibold tracking-widest text-muted-foreground">
        EXPLORER{' '}
        <span className="font-normal tracking-normal">
          {repositoryCount} demo repo{repositoryCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="relative mx-3 mb-3">
        <Search className="pointer-events-none absolute top-2 left-2 size-3.5 text-muted-foreground" />
        <input
          aria-label="Find a file"
          placeholder="Find a file…"
          value={search.value}
          onChange={(event) => search.setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') search.close()
          }}
          className="h-8 w-full rounded-md border bg-background pr-2 pl-7 text-xs outline-none focus:border-primary"
        />
      </div>
      <div className="flex items-center gap-2 border-y px-3 py-2 text-xs font-semibold">
        <FolderOpen className="size-4 text-primary" />
        {storyKey}
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">
          WORKSPACE
        </span>
      </div>
      <nav
        aria-label="Workspace files"
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <FileTree
          model={model}
          aria-label={`${storyKey} files`}
          className={cn('h-full min-h-0', noMatches && 'invisible')}
          style={{ ...treeStyle, colorScheme: appearance }}
        />
        {noMatches && (
          <p
            role="status"
            className="absolute inset-x-0 top-0 px-4 py-6 text-xs text-muted-foreground"
          >
            No matching files.
          </p>
        )}
      </nav>
      <div className="flex items-center gap-2 border-t px-3 py-3 text-xs text-muted-foreground">
        <GitBranch className="size-3.5" />
        Repositories are isolated per US
      </div>
    </aside>
  )
}
