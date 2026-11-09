"use client";

import {
  MiniMap,
  type NodeMouseHandler,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { Maximize2, Moon, Sun, Upload, X, ZoomIn, ZoomOut } from "lucide-react";
import { useTheme } from "next-themes";
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@/components/ai-elements/canvas";
import { Panel } from "@/components/ai-elements/panel";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import defaultGraph from "@/data/agent.json";
import { type AgentFlowNode, type AgentGraph, parseAgentGraph, toFlow } from "@/lib/agent-graph";
import { cn } from "@/lib/utils";
import { NODE_META, STATUS_LABEL } from "./node-meta";
import { nodeTypes } from "./nodes";

const STATUS_DOT = {
  idle: "bg-muted-foreground/40",
  running: "bg-blue-500 animate-pulse",
  success: "bg-green-500",
  error: "bg-red-500",
} as const;

function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <ButtonGroup orientation="vertical">
      <Button className="border" onClick={() => zoomIn()} size="icon" title="Zoom avant" variant="secondary">
        <ZoomIn className="size-4" />
      </Button>
      <Button className="border" onClick={() => zoomOut()} size="icon" title="Zoom arrière" variant="secondary">
        <ZoomOut className="size-4" />
      </Button>
      <Button
        className="border"
        onClick={() => fitView({ padding: 0.2, duration: 300 })}
        size="icon"
        title="Tout afficher"
        variant="secondary"
      >
        <Maximize2 className="size-4" />
      </Button>
    </ButtonGroup>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <Button onClick={() => setTheme(isDark ? "light" : "dark")} size="icon" title="Thème" variant="ghost">
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function NodeDetails({ node, onClose }: { node: AgentFlowNode; onClose: () => void }) {
  const meta = NODE_META[node.data.kind];
  const Icon = meta.icon;
  const status = node.data.status ?? "idle";
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-background">
      <div className="flex items-start gap-3 border-b p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-secondary">
          <Icon className={cn("size-5", meta.color)} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground text-xs">{meta.label}</div>
          <div className="truncate font-semibold text-sm">{node.data.label}</div>
        </div>
        <Button onClick={onClose} size="icon" title="Fermer" variant="ghost">
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-4 overflow-y-auto p-4 text-sm">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", STATUS_DOT[status])} />
          <span>{STATUS_LABEL[status]}</span>
        </div>
        {node.data.description && <p className="text-muted-foreground">{node.data.description}</p>}
        <div>
          <div className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">ID</div>
          <code className="font-mono text-xs">{node.data.id}</code>
        </div>
        {node.data.config && (
          <div>
            <div className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">Config</div>
            <pre className="whitespace-pre-wrap break-words rounded-md border bg-secondary p-3 font-mono text-xs leading-relaxed">
              {JSON.stringify(node.data.config, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </aside>
  );
}

function Viewer() {
  const [graph, setGraph] = useState<AgentGraph>(() => parseAgentGraph(defaultGraph));
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { fitView } = useReactFlow();

  const flow = useMemo(() => toFlow(graph), [graph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentFlowNode>(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);
  const nodesInitialized = useNodesInitialized();
  const pendingFit = useRef(true);

  // Nouveau JSON : on remplace le graphe puis on recadre une fois les nœuds mesurés.
  useEffect(() => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setSelectedId(null);
    pendingFit.current = true;
  }, [flow, setNodes, setEdges]);

  useEffect(() => {
    if (nodesInitialized && pendingFit.current) {
      pendingFit.current = false;
      fitView({ padding: 0.2 });
    }
  }, [nodesInitialized, nodes, fitView]);

  const loadFile = useCallback(async (file: File) => {
    try {
      setGraph(parseAgentGraph(JSON.parse(await file.text())));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON invalide.");
    }
  }, []);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const onNodeClick: NodeMouseHandler<AgentFlowNode> = (_, node) => setSelectedId(node.id);
  const selected = nodes.find((n) => n.id === selectedId);

  return (
    <div className="flex h-dvh flex-col" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <div className="flex size-8 items-center justify-center rounded-md border bg-secondary">
          <NODE_META.agent.icon className="size-4 text-violet-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-sm">{graph.name}</div>
          {graph.description && (
            <div className="truncate text-muted-foreground text-xs">{graph.description}</div>
          )}
        </div>
        <span className="hidden text-muted-foreground text-xs sm:inline">
          {graph.nodes.length} nœuds · lecture seule
        </span>
        <input accept="application/json,.json" className="hidden" onChange={onFileChange} ref={fileInput} type="file" />
        <Button onClick={() => fileInput.current?.click()} size="sm" variant="outline">
          <Upload className="size-4" />
          Importer un JSON
        </Button>
        <ThemeToggle />
      </header>

      {error && (
        <div className="flex items-center justify-between border-b bg-red-500/10 px-4 py-2 text-red-600 text-sm dark:text-red-400">
          {error}
          <Button onClick={() => setError(null)} size="icon" variant="ghost">
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="relative flex-1">
          <Canvas
            deleteKeyCode={null}
            edges={edges}
            edgesFocusable={false}
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.15}
            nodes={nodes}
            nodesConnectable={false}
            nodeTypes={nodeTypes}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodesChange={onNodesChange}
            onPaneClick={() => setSelectedId(null)}
            proOptions={{ hideAttribution: true }}
          >
            <Panel className="border-none bg-transparent p-0" position="bottom-left">
              <ZoomControls />
            </Panel>
            <MiniMap
              bgColor="var(--sidebar)"
              className="rounded-md border"
              maskColor="color-mix(in oklch, var(--background) 60%, transparent)"
              nodeColor="var(--border)"
              pannable
              zoomable
            />
          </Canvas>
        </div>
        {selected && <NodeDetails node={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

export function AgentViewer() {
  return (
    <ReactFlowProvider>
      <Viewer />
    </ReactFlowProvider>
  );
}
