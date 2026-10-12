import { useState, type FormEvent, type ReactNode } from 'react'
import { Check, CircleCheck, Monitor, Moon, Settings, Shield, PlayCircle, Plus, RotateCcw, Sun, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { AdminUsers } from '@/components/settings/admin-users'
import { PageHeader } from '@/components/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConnections, useCreateConnection, useDeleteConnection, useHealth, useMe, useTestAi } from '@/api/hooks'
import { kanbanColumns, type SourceTool } from '@/lib/domain'
import { kanbanColumnStyle, kanbanPresets, useTheme, type ThemeMode } from '@/lib/theme'
import { cn } from '@/lib/utils'

const tools: SourceTool[] = ['Jira', 'Confluence', 'GitLab']

const toolDots: Record<SourceTool, string> = {
  Jira: 'bg-blue-500',
  Confluence: 'bg-sky-500',
  GitLab: 'bg-orange-500',
}

const modes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-xl border bg-card">{children}</div>
    </section>
  )
}

// Setting row: label on the left, control on the right.
function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 p-4 not-last:border-b sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export function SettingsPage() {
  const { data: me } = useMe()
  const [searchParams, setSearchParams] = useSearchParams()
  const section = me?.isAdmin && searchParams.get('section') === 'administration' ? 'administration' : 'preferences'

  return (
    <>
      <PageHeader title="Settings" icon={Settings} />
      <div className="mx-auto w-full max-w-3xl">
        <Tabs value={section} onValueChange={(value) => setSearchParams(value === 'administration' ? { section: value } : {}, { replace: true })} className="gap-8">
          <TabsList variant="line" aria-label="Settings sections">
            <TabsTrigger value="preferences">Preferences & connections</TabsTrigger>
            {me?.isAdmin && <TabsTrigger value="administration"><Shield />Administration</TabsTrigger>}
          </TabsList>
          <TabsContent value="preferences" className="space-y-10">
            <AppearanceSection />
            <ConnectionsSection />
          </TabsContent>
          {me?.isAdmin && (
            <TabsContent value="administration" className="space-y-10">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">Administration</h2>
                <p className="text-sm text-muted-foreground">Manage application access and check the AI service.</p>
              </div>
              <AdminUsers />
              <ModelSection />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  )
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme()

  return (
    <Section title="Appearance" description="Theme and Kanban column colors, saved on this device.">
      <Row label="Theme" description="Follow the system or force light / dark mode.">
        <div className="flex items-center rounded-lg border p-0.5" role="radiogroup" aria-label="Theme">
          {modes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme.mode === value}
              onClick={() => setTheme({ mode: value })}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors',
                theme.mode === value ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </Row>

      {kanbanColumns.map((column) => (
        <Row key={column.id} label={column.title} description="Kanban column background.">
          <ColorPicker
            label={`${column.title} column background`}
            presets={kanbanPresets}
            value={theme.kanbanColumns[column.id] ?? null}
            onChange={(color) => setTheme({ kanbanColumns: { ...theme.kanbanColumns, [column.id]: color ?? undefined } })}
          />
        </Row>
      ))}

      <div className="space-y-3 p-4">
        <p className="text-xs text-muted-foreground">Preview</p>
        <div className="grid grid-cols-5 gap-2">
          {kanbanColumns.map((column) => (
            <div
              key={column.id}
              className="space-y-1.5 rounded-lg bg-muted/40 p-1.5"
              style={kanbanColumnStyle(theme.kanbanColumns[column.id])}
            >
              <p className="truncate px-1 text-xs font-medium">{column.title}</p>
              <div className="h-8 rounded-md bg-card ring-1 ring-foreground/10" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setTheme({ kanbanColumns: {} })}>
            <RotateCcw data-icon="inline-start" />
            Reset colors
          </Button>
        </div>
      </div>
    </Section>
  )
}

type ColorPickerProps = {
  label: string
  presets: string[]
  value: string | null
  onChange: (color: string | null) => void
}

function ColorPicker({ label, presets, value, onChange }: ColorPickerProps) {
  const custom = value !== null && !presets.includes(value)

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}>
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label="Default"
        title="Default"
        onClick={() => onChange(null)}
        className={cn(
          'flex h-6 items-center rounded-full border px-2 text-xs transition-colors',
          value === null ? 'border-foreground text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Default
      </button>
      {presets.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          title={color}
          onClick={() => onChange(color)}
          className="flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-shadow aria-checked:ring-2 aria-checked:ring-foreground"
          style={{ backgroundColor: color }}
        >
          {value === color && <Check className="size-3.5 text-white" aria-hidden="true" />}
        </button>
      ))}
      {/* Rainbow swatch: open the native picker to choose any color. */}
      <label
        title="Custom color"
        className={cn(
          'relative size-6 cursor-pointer rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] ring-offset-2 ring-offset-card',
          custom && 'ring-2 ring-foreground',
        )}
        style={custom ? { background: value } : undefined}
      >
        <input
          type="color"
          aria-label={`${label} (custom)`}
          value={value ?? presets[0]}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}

function ModelSection() {
  // GET /health also returns the LLM configuration.
  const { data: health, isLoading, isError } = useHealth()
  const testAi = useTestAi()

  return (
    <Section
      title="AI model"
      description="Check the model configured by your administrator and test its availability."
    >
      {isLoading && <p className="p-4 text-sm text-muted-foreground">Checking the AI service…</p>}
      {isError && <p role="alert" className="p-4 text-sm text-destructive">Could not check the AI service.</p>}
      {testAi.isError && <p role="alert" className="p-4 text-sm text-destructive">The connection test failed. Please try again.</p>}
      {health && (
        <div className="p-4 pb-0">
          <Alert
            className={
              health.llmConfigured
                ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200'
                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
            }
          >
            <CircleCheck />
            <AlertDescription className="text-inherit">
              {health.llmConfigured ? 'AI model is configured.' : 'An administrator needs to configure the AI model.'}
            </AlertDescription>
          </Alert>
        </div>
      )}
      {health && <Row label="Service status" description="Application backend">
        <span className="text-sm">{health.status}</span>
      </Row>}
      <Row label="Model" description={health?.llmModel ?? '…'}>
        <div className="flex items-center gap-3">
          {testAi.data && (
            <span className="text-sm text-muted-foreground">
              {testAi.data.ok ? 'OK' : 'Failed'} · {testAi.data.latencyMs} ms
            </span>
          )}
          <Button variant="outline" disabled={testAi.isLoading || !health?.llmConfigured} onClick={() => testAi.trigger()}>
            <PlayCircle data-icon="inline-start" />
            Test connection
          </Button>
        </div>
      </Row>
    </Section>
  )
}

function ConnectionsSection() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Tool connections</h2>
        <p className="text-sm text-muted-foreground">
          Connect your accounts to browse Jira projects, Confluence spaces and GitLab repositories. Access tokens are stored securely.
        </p>
      </div>

      <Tabs defaultValue={tools[0]} className="gap-4">
        <TabsList className="h-9 w-full">
          {tools.map((tool) => (
            <ToolTab key={tool} tool={tool} />
          ))}
        </TabsList>
        {tools.map((tool) => (
          <TabsContent key={tool} value={tool}>
            <ToolConnections tool={tool} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}

function ToolTab({ tool }: { tool: SourceTool }) {
  const { data: connections = [] } = useConnections(tool)
  return (
    <TabsTrigger value={tool}>
      <span className={cn('size-2 rounded-full', toolDots[tool])} aria-hidden="true" />
      {tool}
      <span className="text-xs font-normal text-muted-foreground tabular-nums">{connections.length}</span>
    </TabsTrigger>
  )
}

function ToolConnections({ tool }: { tool: SourceTool }) {
  const { data: connections = [] } = useConnections(tool)
  const deleteConnection = useDeleteConnection(tool)

  return (
    <div className="rounded-xl border bg-card">
      {connections.length === 0 ? (
        <p className="border-b p-4 text-sm text-muted-foreground">No {tool} connection yet.</p>
      ) : (
        <ul>
          {connections.map((connection) => (
            <li key={connection.id} className="flex items-center gap-3 border-b p-4">
              <span className={cn('size-2 shrink-0 rounded-full', toolDots[tool])} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{connection.displayName ?? connection.siteUrl}</p>
                {connection.displayName && <p className="truncate text-xs text-muted-foreground">{connection.siteUrl}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${connection.displayName ?? connection.siteUrl}`}
                disabled={deleteConnection.isLoading}
                onClick={() => deleteConnection.trigger(connection.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <NewConnectionForm tool={tool} />
    </div>
  )
}

function NewConnectionForm({ tool }: { tool: SourceTool }) {
  const createConnection = useCreateConnection(tool)
  const [displayName, setDisplayName] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [pat, setPat] = useState('')
  const id = `connection-${tool.toLowerCase()}`

  const submit = (event: FormEvent) => {
    event.preventDefault()
    createConnection.trigger({ siteUrl, pat, displayName: displayName || undefined }).unwrap().then(() => {
      setDisplayName('')
      setSiteUrl('')
      setPat('')
    }).catch(() => undefined)
  }

  return (
    <form onSubmit={submit} className="space-y-3 p-4">
      <p className="text-sm font-medium">Add a {tool} connection</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input id={`${id}-name`} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={`${tool} (company)`} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-url`}>URL</Label>
          <Input
            id={`${id}-url`}
            type="url"
            required
            value={siteUrl}
            onChange={(event) => setSiteUrl(event.target.value)}
            placeholder={`https://${tool.toLowerCase()}.example.com`}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-pat`}>Personal access token</Label>
        <Input id={`${id}-pat`} type="password" required autoComplete="off" value={pat} onChange={(event) => setPat(event.target.value)} />
      </div>
      {createConnection.isError && (
        <p className="text-sm text-destructive">Could not save the connection: {createConnection.error.message}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={createConnection.isLoading}>
          <Plus data-icon="inline-start" />
          Add connection
        </Button>
      </div>
    </form>
  )
}
