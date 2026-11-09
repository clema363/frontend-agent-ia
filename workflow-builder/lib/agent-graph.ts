import type { Edge, Node } from "@xyflow/react";

/**
 * Format JSON d'un agent.
 *
 * - `nodes[].kind` choisit le rendu du nœud.
 * - `edges[].kind` vaut "main" (flux principal, de gauche à droite) ou
 *   "model" | "memory" | "tool" (sous-nœud branché sous un nœud agent, comme dans n8n).
 * - `position` est optionnelle : sans elle, les nœuds sont placés automatiquement.
 */
export type AgentNodeKind =
  | "trigger"
  | "agent"
  | "condition"
  | "action"
  | "output"
  | "model"
  | "memory"
  | "tool";

export type AgentNodeStatus = "idle" | "running" | "success" | "error";

export type AgentEdgeKind = "main" | "model" | "memory" | "tool";

export type AgentGraphNode = {
  id: string;
  kind: AgentNodeKind;
  label: string;
  description?: string;
  status?: AgentNodeStatus;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
};

export type AgentGraphEdge = {
  id?: string;
  source: string;
  target: string;
  kind?: AgentEdgeKind;
  label?: string;
};

export type AgentGraph = {
  name: string;
  description?: string;
  nodes: AgentGraphNode[];
  edges: AgentGraphEdge[];
};

export type AgentFlowNodeData = AgentGraphNode & Record<string, unknown>;
export type AgentFlowNode = Node<AgentFlowNodeData>;

export const SUB_NODE_KINDS: AgentNodeKind[] = ["model", "memory", "tool"];

const COLUMN_WIDTH = 340;
const ROW_HEIGHT = 300;
const SUB_NODE_GAP = 130;
const SUB_NODE_OFFSET_Y = 230;
const AGENT_WIDTH = 300;
const SUB_NODE_SIZE = 72;

/** Vérifie la forme minimale du JSON et renvoie un message d'erreur lisible. */
export function parseAgentGraph(value: unknown): AgentGraph {
  if (!value || typeof value !== "object") {
    throw new Error("Le JSON doit être un objet.");
  }
  const graph = value as Partial<AgentGraph>;
  if (!Array.isArray(graph.nodes)) {
    throw new Error('Champ "nodes" manquant ou invalide.');
  }
  if (!Array.isArray(graph.edges)) {
    throw new Error('Champ "edges" manquant ou invalide.');
  }
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (!(node && typeof node.id === "string" && typeof node.kind === "string")) {
      throw new Error('Chaque nœud doit avoir un "id" et un "kind".');
    }
    ids.add(node.id);
  }
  for (const edge of graph.edges) {
    if (!(ids.has(edge.source) && ids.has(edge.target))) {
      throw new Error(
        `Lien invalide : "${edge.source}" → "${edge.target}" (nœud introuvable).`
      );
    }
  }
  return {
    name: graph.name ?? "Agent sans nom",
    description: graph.description,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

/** Place automatiquement les nœuds sans position : colonnes pour le flux principal, sous-nœuds sous leur agent. */
function layout(graph: AgentGraph): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const isSub = (id: string) =>
    SUB_NODE_KINDS.includes(graph.nodes.find((n) => n.id === id)?.kind ?? "action");

  const mainEdges = graph.edges.filter(
    (e) => (e.kind ?? "main") === "main" && !isSub(e.target)
  );
  const mainNodes = graph.nodes.filter((n) => !SUB_NODE_KINDS.includes(n.kind));

  // Profondeur = plus long chemin depuis une racine.
  const depth = new Map<string, number>();
  const visit = (id: string, seen: Set<string>): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return 0;
    seen.add(id);
    const parents = mainEdges.filter((e) => e.target === id);
    const d = parents.length
      ? Math.max(...parents.map((e) => visit(e.source, seen) + 1))
      : 0;
    depth.set(id, d);
    return d;
  };
  for (const node of mainNodes) visit(node.id, new Set());

  const columns = new Map<number, AgentGraphNode[]>();
  for (const node of mainNodes) {
    const d = depth.get(node.id) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), node]);
  }
  for (const [col, nodes] of columns) {
    nodes.forEach((node, row) => {
      const y = (row - (nodes.length - 1) / 2) * ROW_HEIGHT;
      positions.set(node.id, node.position ?? { x: col * COLUMN_WIDTH, y });
    });
  }

  // Sous-nœuds (modèle, mémoire, outils) centrés sous leur agent.
  for (const parent of mainNodes) {
    const children = graph.edges
      .filter((e) => e.source === parent.id && isSub(e.target))
      .map((e) => graph.nodes.find((n) => n.id === e.target))
      .filter((n): n is AgentGraphNode => Boolean(n));
    const origin = positions.get(parent.id);
    if (!origin) continue;
    children.forEach((child, i) => {
      if (positions.has(child.id)) return;
      const x =
        origin.x +
        AGENT_WIDTH / 2 -
        SUB_NODE_SIZE / 2 +
        (i - (children.length - 1) / 2) * SUB_NODE_GAP;
      positions.set(child.id, child.position ?? { x, y: origin.y + SUB_NODE_OFFSET_Y });
    });
  }

  graph.nodes.forEach((node, i) => {
    if (!positions.has(node.id)) {
      positions.set(node.id, node.position ?? { x: i * COLUMN_WIDTH, y: ROW_HEIGHT * 2 });
    }
  });
  return positions;
}

/** Convertit le JSON de l'agent en nœuds/liens React Flow. */
export function toFlow(graph: AgentGraph): { nodes: AgentFlowNode[]; edges: Edge[] } {
  const positions = layout(graph);
  const kindOf = new Map(graph.nodes.map((n) => [n.id, n.kind]));

  const nodes: AgentFlowNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: SUB_NODE_KINDS.includes(node.kind) ? "sub" : node.kind === "agent" ? "agent" : "step",
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: node as AgentFlowNodeData,
  }));

  const edges: Edge[] = graph.edges.map((edge, i) => {
    const targetKind = kindOf.get(edge.target) ?? "action";
    const isSubEdge = SUB_NODE_KINDS.includes(targetKind);
    const handle = isSubEdge ? (edge.kind && edge.kind !== "main" ? edge.kind : targetKind) : undefined;
    const running = graph.nodes.find((n) => n.id === edge.target)?.status === "running";
    return {
      id: edge.id ?? `e-${i}-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: handle,
      targetHandle: isSubEdge ? "top" : undefined,
      label: edge.label,
      type: isSubEdge ? "default" : "smoothstep",
      animated: running,
      style: {
        stroke: "var(--muted-foreground)",
        strokeWidth: isSubEdge ? 1.5 : 2,
        strokeDasharray: isSubEdge ? "6 4" : undefined,
        opacity: 0.6,
      },
      labelBgStyle: { fill: "var(--card)" },
      labelStyle: { fill: "var(--muted-foreground)", fontSize: 11 },
    };
  });

  return { nodes, edges };
}
