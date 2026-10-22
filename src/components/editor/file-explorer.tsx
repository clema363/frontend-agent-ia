import { FileTree, useFileTree, useFileTreeSearch } from '@pierre/trees/react'
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import {
  FileCode2,
  FileJson,
  FileText,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { useEditorAppearance } from '@/hooks/use-editor-appearance'
import type { WorkspaceFile } from '@/lib/editor-workspace'
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
  '--trees-font-size-override': '13px',
  '--trees-item-margin-x-override': '6px',
  '--trees-border-radius-override': '8px',
  '--trees-hover-bg-override': 'var(--accent)',
  '--trees-selected-bg-override': 'var(--accent)',
  '--trees-theme-focus-ring': 'var(--ring)',
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
  const latest = useRef({ onOpen, active, files })
  useEffect(() => {
    latest.current = { onOpen, active, files }
  }, [onOpen, active, files])
  const { model } = useFileTree({
    paths: files.map((file) => file.path),
    initialExpansion: 'closed',
    initialSelectedPaths: active ? [active] : [],
    flattenEmptyDirectories: false,
    search: false,
    fileTreeSearchMode: 'hide-non-matches',
    density: 'default',
    icons: { set: 'complete', colored: true },
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
  const search = useFileTreeSearch(model)

  return (
    <aside
      aria-label="File explorer"
      className="flex min-h-0 w-66 shrink-0 flex-col border-r bg-background"
    >
      <div className="shrink-0 border-b p-2">
        <label className="flex h-8 items-center gap-2 rounded-lg border bg-background px-2.5 text-muted-foreground focus-within:border-ring">
          <Search className="size-4 shrink-0" />
          <input
            aria-label="Filter files"
            placeholder="Search files..."
            value={search.value}
            onChange={(event) => search.setValue(event.target.value || null)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') search.setValue(null)
              const match = search.matchingPaths.find((path) =>
                files.some((file) => file.path === path),
              )
              if (event.key === 'Enter' && match) onOpen(match)
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </label>
      </div>
      <nav
        aria-label={`${storyKey} workspace files`}
        className="relative min-h-0 flex-1 overflow-hidden py-1.5"
      >
        <FileTree
          model={model}
          aria-label={`${storyKey} files`}
          className="h-full min-h-0"
          style={{ ...treeStyle, colorScheme: appearance }}
        />
      </nav>
    </aside>
  )
}

export function EditorSidebar({
  label,
  icon: Icon,
  title,
  meta,
  children,
}: {
  label: string
  icon: LucideIcon
  title: string
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <aside
      aria-label={label}
      className="flex min-h-0 w-66 shrink-0 flex-col border-r bg-background"
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/85">
          {title}
        </span>
        {meta}
      </div>
      {children}
    </aside>
  )
}

/** File row shared by the changes and search panes: name first, folder muted. */
export function FileRow({
  path,
  selected,
  trailing,
  onOpen,
}: {
  path: string
  selected: boolean
  trailing?: ReactNode
  onOpen: (path: string) => void
}) {
  const slash = path.lastIndexOf('/')
  const name = path.slice(slash + 1)
  const dir = slash > 0 ? path.slice(0, slash) : ''
  return (
    <button
      type="button"
      title={path}
      aria-current={selected || undefined}
      onClick={() => onOpen(path)}
      className={cn(
        'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-xs transition-colors focus-visible:bg-accent focus-visible:outline-none',
        selected
          ? 'bg-accent text-foreground'
          : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground',
      )}
    >
      <FileIcon path={path} className="size-3.5" />
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden">
        <span className="shrink-0 truncate font-medium">{name}</span>
        {dir && (
          <span className="min-w-0 truncate text-[11px] text-muted-foreground/60">
            {dir}
          </span>
        )}
      </span>
      {trailing}
    </button>
  )
}
