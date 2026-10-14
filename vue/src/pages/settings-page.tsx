import {
  useConnections,
  useCreateConnection,
  useDeleteConnection,
  useHealth,
  useMe,
  useTestAi,
} from "@/api/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { AdminUsers } from "@/components/settings/admin-users";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { kanbanColumns, type SourceTool } from "@/lib/domain";
import type { FormEvent } from "@/lib/events";
import { useSearchParams } from "@/lib/router";
import {
  kanbanColumnStyle,
  kanbanPresets,
  useTheme,
  type ThemeMode,
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  Check,
  CircleCheck,
  Monitor,
  Moon,
  PlayCircle,
  Plus,
  RotateCcw,
  Settings,
  Shield,
  Sun,
  Trash2,
} from "@lucide/vue";
import { defineComponent, ref, type VNodeChild } from "vue";
const tools: SourceTool[] = ["Jira", "Confluence", "GitLab"];
const toolDots: Record<SourceTool, string> = {
  Jira: "bg-blue-500",
  Confluence: "bg-sky-500",
  GitLab: "bg-orange-500",
};
const modes: {
  value: ThemeMode;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];
const Section = defineComponent(
  (
    __props: {
      title: string;
      description: VNodeChild;
      children?: VNodeChild;
    },
    { slots },
  ) => {
    return () => {
      const { title, description, children } = {
        ...__props,
        children: slots.default?.(),
      };
      return (
        <section class="space-y-4">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold tracking-tight">{title}</h2>
            <p class="text-sm text-muted-foreground">{description}</p>
          </div>
          <div class="rounded-xl border bg-card">{children}</div>
        </section>
      );
    };
  },
  { name: "Section", props: ["title", "description"], inheritAttrs: false },
);
const Row = defineComponent(
  (
    __props: {
      label: string;
      description?: string;
      children?: VNodeChild;
    },
    { slots },
  ) => {
    return () => {
      const { label, description, children } = {
        ...__props,
        children: slots.default?.(),
      };
      return (
        <div class="flex flex-col gap-3 p-4 not-last:border-b sm:flex-row sm:items-center sm:justify-between">
          <div class="space-y-0.5">
            <p class="text-sm font-medium">{label}</p>
            {description && (
              <p class="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {children}
        </div>
      );
    };
  },
  { name: "Row", props: ["label", "description"], inheritAttrs: false },
);
export const SettingsPage = defineComponent(
  (__props: Record<string, never>) => {
    const meState0 = useMe();
    const searchParamsState1 = useSearchParams();
    return () => {
      const { data: me } = meState0;
      const [searchParams, setSearchParams] = searchParamsState1;
      const section =
        me?.isAdmin && searchParams.get("section") === "administration"
          ? "administration"
          : "preferences";
      return (
        <>
          <PageHeader title="Settings" icon={Settings} />
          <div class="mx-auto w-full max-w-3xl">
            <Tabs
              modelValue={section}
              onUpdate:modelValue={(value) =>
                setSearchParams(
                  value === "administration" ? { section: value } : {},
                  { replace: true },
                )
              }
              class="gap-8"
            >
              <TabsList variant="line" aria-label="Settings sections">
                <TabsTrigger value="preferences">
                  Preferences & connections
                </TabsTrigger>
                {me?.isAdmin && (
                  <TabsTrigger value="administration">
                    <Shield />
                    Administration
                  </TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="preferences" class="space-y-10">
                <AppearanceSection />
                <ConnectionsSection />
              </TabsContent>
              {me?.isAdmin && (
                <TabsContent value="administration" class="space-y-10">
                  <div class="space-y-1">
                    <h2 class="text-lg font-semibold tracking-tight">
                      Administration
                    </h2>
                    <p class="text-sm text-muted-foreground">
                      Manage application access and check the AI service.
                    </p>
                  </div>
                  <AdminUsers />
                  <ModelSection />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </>
      );
    };
  },
  { name: "SettingsPage", props: [], inheritAttrs: false },
);
const AppearanceSection = defineComponent(
  (__props: Record<string, never>) => {
    const themeState2 = useTheme();
    return () => {
      const { theme, setTheme } = themeState2;
      return (
        <Section
          title="Appearance"
          description="Theme and Kanban column colors, saved on this device."
        >
          <Row
            label="Theme"
            description="Follow the system or force light / dark mode."
          >
            <div
              class="flex items-center rounded-lg border p-0.5"
              role="radiogroup"
              aria-label="Theme"
            >
              {modes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme.mode === value}
                  onClick={() => setTheme({ mode: value })}
                  class={cn(
                    "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors",
                    theme.mode === value
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon class="size-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </Row>

          {kanbanColumns.map((column) => (
            <Row
              key={column.id}
              label={column.title}
              description="Kanban column background."
            >
              <ColorPicker
                label={`${column.title} column background`}
                presets={kanbanPresets}
                value={theme.kanbanColumns[column.id] ?? null}
                onFilterChange={(color) =>
                  setTheme({
                    kanbanColumns: {
                      ...theme.kanbanColumns,
                      [column.id]: color ?? undefined,
                    },
                  })
                }
              />
            </Row>
          ))}

          <div class="space-y-3 p-4">
            <p class="text-xs text-muted-foreground">Preview</p>
            <div class="grid grid-cols-5 gap-2">
              {kanbanColumns.map((column) => (
                <div
                  key={column.id}
                  class="space-y-1.5 rounded-lg bg-muted/40 p-1.5"
                  style={kanbanColumnStyle(theme.kanbanColumns[column.id])}
                >
                  <p class="truncate px-1 text-xs font-medium">
                    {column.title}
                  </p>
                  <div class="h-8 rounded-md bg-card ring-1 ring-foreground/10" />
                </div>
              ))}
            </div>
            <div class="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme({ kanbanColumns: {} })}
              >
                <RotateCcw data-icon="inline-start" />
                Reset colors
              </Button>
            </div>
          </div>
        </Section>
      );
    };
  },
  { name: "AppearanceSection", props: [], inheritAttrs: false },
);
type ColorPickerProps = {
  label: string;
  presets: string[];
  value: string | null;
  onFilterChange: (color: string | null) => void;
};
const ColorPicker = defineComponent(
  (__props: ColorPickerProps) => {
    return () => {
      const { label, presets, value, onFilterChange } = __props;
      const custom = value !== null && !presets.includes(value);
      return (
        <div
          class="flex flex-wrap items-center gap-1.5"
          role="radiogroup"
          aria-label={label}
        >
          <button
            type="button"
            role="radio"
            aria-checked={value === null}
            aria-label="Default"
            title="Default"
            onClick={() => onFilterChange(null)}
            class={cn(
              "flex h-6 items-center rounded-full border px-2 text-xs transition-colors",
              value === null
                ? "border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground",
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
              onClick={() => onFilterChange(color)}
              class="flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-shadow aria-checked:ring-2 aria-checked:ring-foreground"
              style={{ backgroundColor: color }}
            >
              {value === color && (
                <Check class="size-3.5 text-white" aria-hidden="true" />
              )}
            </button>
          ))}
          {/* Rainbow swatch: open the native picker to choose any color. */}
          <label
            title="Custom color"
            class={cn(
              "relative size-6 cursor-pointer rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] ring-offset-2 ring-offset-card",
              custom && "ring-2 ring-foreground",
            )}
            style={custom ? { background: value } : undefined}
          >
            <input
              type="color"
              aria-label={`${label} (custom)`}
              value={value ?? presets[0]}
              onInput={(event) =>
                onFilterChange((event.target as HTMLInputElement).value)
              }
              class="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      );
    };
  },
  {
    name: "ColorPicker",
    props: ["label", "presets", "value", "onFilterChange"],
    inheritAttrs: false,
  },
);
const ModelSection = defineComponent(
  (__props: Record<string, never>) => {
    const healthState3 = useHealth();
    const testAiState4 = useTestAi();
    return () => {
      // GET /health also returns the LLM configuration.
      const { data: health, isLoading, isError } = healthState3;
      const testAi = testAiState4;
      return (
        <Section
          title="AI model"
          description="Check the model configured by your administrator and test its availability."
        >
          {isLoading && (
            <p class="p-4 text-sm text-muted-foreground">
              Checking the AI service…
            </p>
          )}
          {isError && (
            <p role="alert" class="p-4 text-sm text-destructive">
              Could not check the AI service.
            </p>
          )}
          {testAi.isError && (
            <p role="alert" class="p-4 text-sm text-destructive">
              The connection test failed. Please try again.
            </p>
          )}
          {health && (
            <div class="p-4 pb-0">
              <Alert
                class={
                  health.llmConfigured
                    ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200"
                    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                }
              >
                <CircleCheck />
                <AlertDescription class="text-inherit">
                  {health.llmConfigured
                    ? "AI model is configured."
                    : "An administrator needs to configure the AI model."}
                </AlertDescription>
              </Alert>
            </div>
          )}
          {health && (
            <Row label="Service status" description="Application backend">
              <span class="text-sm">{health.status}</span>
            </Row>
          )}
          <Row label="Model" description={health?.llmModel ?? "…"}>
            <div class="flex items-center gap-3">
              {testAi.data && (
                <span class="text-sm text-muted-foreground">
                  {testAi.data.ok ? "OK" : "Failed"} · {testAi.data.latencyMs}{" "}
                  ms
                </span>
              )}
              <Button
                variant="outline"
                disabled={testAi.isLoading || !health?.llmConfigured}
                onClick={() => testAi.trigger()}
              >
                <PlayCircle data-icon="inline-start" />
                Test connection
              </Button>
            </div>
          </Row>
        </Section>
      );
    };
  },
  { name: "ModelSection", props: [], inheritAttrs: false },
);
const ConnectionsSection = defineComponent(
  (__props: Record<string, never>) => {
    return () => {
      return (
        <section class="space-y-4">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold tracking-tight">
              Tool connections
            </h2>
            <p class="text-sm text-muted-foreground">
              Connect your accounts to browse Jira projects, Confluence spaces
              and GitLab repositories. Access tokens are stored securely.
            </p>
          </div>

          <Tabs defaultValue={tools[0]} class="gap-4">
            <TabsList class="h-9 w-full">
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
      );
    };
  },
  { name: "ConnectionsSection", props: [], inheritAttrs: false },
);
const ToolTab = defineComponent(
  (__props: { tool: SourceTool }) => {
    const { tool } = __props;
    const connectionsState5 = useConnections(() => tool);
    return () => {
      const { tool } = __props;
      const { data: connections = [] } = connectionsState5;
      return (
        <TabsTrigger value={tool}>
          <span
            class={cn("size-2 rounded-full", toolDots[tool])}
            aria-hidden="true"
          />
          {tool}
          <span class="text-xs font-normal text-muted-foreground tabular-nums">
            {connections.length}
          </span>
        </TabsTrigger>
      );
    };
  },
  { name: "ToolTab", props: ["tool"], inheritAttrs: false },
);
const ToolConnections = defineComponent(
  (__props: { tool: SourceTool }) => {
    const { tool } = __props;
    const connectionsState6 = useConnections(() => tool);
    const deleteConnectionState7 = useDeleteConnection(tool);
    return () => {
      const { tool } = __props;
      const { data: connections = [] } = connectionsState6;
      const deleteConnection = deleteConnectionState7;
      return (
        <div class="rounded-xl border bg-card">
          {connections.length === 0 ? (
            <p class="border-b p-4 text-sm text-muted-foreground">
              No {tool} connection yet.
            </p>
          ) : (
            <ul>
              {connections.map((connection) => (
                <li
                  key={connection.id}
                  class="flex items-center gap-3 border-b p-4"
                >
                  <span
                    class={cn("size-2 shrink-0 rounded-full", toolDots[tool])}
                    aria-hidden="true"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">
                      {connection.displayName ?? connection.siteUrl}
                    </p>
                    {connection.displayName && (
                      <p class="truncate text-xs text-muted-foreground">
                        {connection.siteUrl}
                      </p>
                    )}
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
      );
    };
  },
  { name: "ToolConnections", props: ["tool"], inheritAttrs: false },
);
const NewConnectionForm = defineComponent(
  (__props: { tool: SourceTool }) => {
    const { tool } = __props;
    const createConnectionState8 = useCreateConnection(tool);

    const displayName = ref("");
    const setDisplayName = (
      next:
        | typeof displayName.value
        | ((current: typeof displayName.value) => typeof displayName.value),
    ) => {
      displayName.value =
        typeof next === "function"
          ? (
              next as (
                current: typeof displayName.value,
              ) => typeof displayName.value
            )(displayName.value)
          : next;
    };
    const siteUrl = ref("");
    const setSiteUrl = (
      next:
        | typeof siteUrl.value
        | ((current: typeof siteUrl.value) => typeof siteUrl.value),
    ) => {
      siteUrl.value =
        typeof next === "function"
          ? (next as (current: typeof siteUrl.value) => typeof siteUrl.value)(
              siteUrl.value,
            )
          : next;
    };
    const pat = ref("");
    const setPat = (
      next:
        typeof pat.value | ((current: typeof pat.value) => typeof pat.value),
    ) => {
      pat.value =
        typeof next === "function"
          ? (next as (current: typeof pat.value) => typeof pat.value)(pat.value)
          : next;
    };
    return () => {
      const { tool } = __props;
      const createConnection = createConnectionState8;
      const id = `connection-${tool.toLowerCase()}`;
      const submit = (event: FormEvent) => {
        event.preventDefault();
        createConnection
          .trigger({
            siteUrl: siteUrl.value,
            pat: pat.value,
            displayName: displayName.value || undefined,
          })
          .then(() => {
            setDisplayName("");
            setSiteUrl("");
            setPat("");
          })
          .catch(() => undefined);
      };
      return (
        <form onSubmit={submit} class="space-y-3 p-4">
          <p class="text-sm font-medium">Add a {tool} connection</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label for={`${id}-name`}>Name</Label>
              <Input
                id={`${id}-name`}
                modelValue={displayName.value}
                onInput={(event) =>
                  setDisplayName((event.target as HTMLInputElement).value)
                }
                placeholder={`${tool} (company)`}
              />
            </div>
            <div class="space-y-1.5">
              <Label for={`${id}-url`}>URL</Label>
              <Input
                id={`${id}-url`}
                type="url"
                required
                modelValue={siteUrl.value}
                onInput={(event) =>
                  setSiteUrl((event.target as HTMLInputElement).value)
                }
                placeholder={`https://${tool.toLowerCase()}.example.com`}
              />
            </div>
          </div>
          <div class="space-y-1.5">
            <Label for={`${id}-pat`}>Personal access token</Label>
            <Input
              id={`${id}-pat`}
              type="password"
              required
              autoComplete="off"
              modelValue={pat.value}
              onInput={(event) =>
                setPat((event.target as HTMLInputElement).value)
              }
            />
          </div>
          {createConnection.isError && (
            <p class="text-sm text-destructive">
              Could not save the connection: {createConnection.error.message}
            </p>
          )}
          <div class="flex justify-end">
            <Button type="submit" disabled={createConnection.isLoading}>
              <Plus data-icon="inline-start" />
              Add connection
            </Button>
          </div>
        </form>
      );
    };
  },
  { name: "NewConnectionForm", props: ["tool"], inheritAttrs: false },
);
