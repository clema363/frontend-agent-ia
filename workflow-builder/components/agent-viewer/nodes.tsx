"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Check, XCircle } from "lucide-react";
import { memo } from "react";
import { Node, NodeDescription, NodeTitle } from "@/components/ai-elements/node";
import type { AgentFlowNode, AgentNodeStatus } from "@/lib/agent-graph";
import { cn } from "@/lib/utils";
import { NODE_META } from "./node-meta";

const StatusBadge = ({ status }: { status?: AgentNodeStatus }) => {
  if (status !== "success" && status !== "error") return null;
  return (
    <div
      className={cn(
        "absolute top-2 right-2 rounded-full p-1",
        status === "success" ? "bg-green-500/60" : "bg-red-500/60"
      )}
    >
      {status === "success" ? (
        <Check className="size-3 text-white" strokeWidth={2.5} />
      ) : (
        <XCircle className="size-3 text-white" strokeWidth={2.5} />
      )}
    </div>
  );
};

/** Nœud du flux principal : déclencheur, condition, action, sortie. */
export const StepNode = memo(({ data, selected }: NodeProps<AgentFlowNode>) => {
  const meta = NODE_META[data.kind];
  const Icon = meta.icon;
  return (
    <Node
      className={cn("w-60 shadow-none", selected && "border-primary")}
      handles={{ target: data.kind !== "trigger", source: data.kind !== "output" }}
      status={data.status}
    >
      <StatusBadge status={data.status} />
      <div className="flex items-center gap-3 p-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-secondary">
          <Icon className={cn("size-5", meta.color)} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <NodeTitle className="truncate text-sm">{data.label}</NodeTitle>
          {data.description && (
            <NodeDescription className="truncate text-xs">{data.description}</NodeDescription>
          )}
        </div>
      </div>
    </Node>
  );
});
StepNode.displayName = "StepNode";

const AGENT_SLOTS = [
  { id: "model", label: "Modèle" },
  { id: "memory", label: "Mémoire" },
  { id: "tool", label: "Outils" },
] as const;

/** Nœud agent : entrées/sorties à gauche/droite, modèle/mémoire/outils en bas (comme n8n). */
export const AgentNode = memo(({ data, selected }: NodeProps<AgentFlowNode>) => {
  const meta = NODE_META.agent;
  const Icon = meta.icon;
  return (
    <Node
      className={cn("w-[300px] shadow-none", selected && "border-primary")}
      handles={{ target: true, source: true }}
      status={data.status}
    >
      <StatusBadge status={data.status} />
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-secondary">
          <Icon className={cn("size-6", meta.color)} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <NodeTitle className="truncate text-sm">{data.label}</NodeTitle>
          {data.description && (
            <NodeDescription className="line-clamp-2 text-xs">{data.description}</NodeDescription>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 border-t">
        {AGENT_SLOTS.map((slot, i) => (
          <div className="relative py-2 text-center text-[10px] text-muted-foreground uppercase tracking-wide" key={slot.id}>
            {slot.label}
            <Handle
              className="handle-sub"
              id={slot.id}
              position={Position.Bottom}
              style={{ left: `${((i + 0.5) / AGENT_SLOTS.length) * 100}%` }}
              type="source"
            />
          </div>
        ))}
      </div>
    </Node>
  );
});
AgentNode.displayName = "AgentNode";

/** Sous-nœud rond (modèle, mémoire, outil) branché sous un agent. */
export const SubNode = memo(({ data, selected }: NodeProps<AgentFlowNode>) => {
  const meta = NODE_META[data.kind];
  const Icon = meta.icon;
  return (
    <div className="flex w-[72px] flex-col items-center gap-2">
      <div
        className={cn(
          "relative flex size-[72px] items-center justify-center rounded-full border bg-card transition-colors",
          selected && "border-primary",
          data.status === "success" && "border-2 border-green-500",
          data.status === "error" && "border-2 border-red-500"
        )}
      >
        <Handle className="handle-sub" id="top" position={Position.Top} type="target" />
        <Icon className={cn("size-7", meta.color)} strokeWidth={1.5} />
      </div>
      <div className="w-32 text-center">
        <div className="truncate font-medium text-xs">{data.label}</div>
        {data.description && (
          <div className="truncate text-[10px] text-muted-foreground">{data.description}</div>
        )}
      </div>
    </div>
  );
});
SubNode.displayName = "SubNode";

export const nodeTypes = { step: StepNode, agent: AgentNode, sub: SubNode };
