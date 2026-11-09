import {
  Bot,
  Brain,
  Database,
  Flag,
  GitBranch,
  type LucideIcon,
  Play,
  Wrench,
  Zap,
} from "lucide-react";
import type { AgentNodeKind } from "@/lib/agent-graph";

export const NODE_META: Record<
  AgentNodeKind,
  { icon: LucideIcon; label: string; color: string }
> = {
  trigger: { icon: Zap, label: "Déclencheur", color: "text-amber-500" },
  agent: { icon: Bot, label: "Agent", color: "text-violet-500" },
  condition: { icon: GitBranch, label: "Condition", color: "text-sky-500" },
  action: { icon: Play, label: "Action", color: "text-emerald-500" },
  output: { icon: Flag, label: "Sortie", color: "text-rose-500" },
  model: { icon: Brain, label: "Modèle", color: "text-violet-500" },
  memory: { icon: Database, label: "Mémoire", color: "text-orange-500" },
  tool: { icon: Wrench, label: "Outil", color: "text-teal-500" },
};

export const STATUS_LABEL = {
  idle: "En attente",
  running: "En cours",
  success: "Terminé",
  error: "Erreur",
} as const;
