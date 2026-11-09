# Agent Viewer

Visualiseur d'agents **en lecture seule**, façon n8n : un fichier JSON → un canvas de nœuds.
Pas de base de données, pas d'authentification.

Basé sur [vercel-labs/workflow-builder-template](https://github.com/vercel-labs/workflow-builder-template) (Apache-2.0, voir `LICENSE`),
réduit à son canvas React Flow et à ses composants shadcn.

## Lancer

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## Données

Le graphe affiché par défaut est `data/agent.json`. Le bouton **Importer un JSON**
(ou un glisser-déposer sur la page) charge un autre fichier, uniquement dans le navigateur.

```jsonc
{
  "name": "Mon agent",
  "description": "optionnel",
  "nodes": [
    {
      "id": "agent",
      "kind": "agent",          // trigger | agent | condition | action | output | model | memory | tool
      "label": "Agent support",
      "description": "optionnel",
      "status": "running",      // optionnel : idle | running | success | error
      "position": { "x": 0, "y": 0 }, // optionnel : placement automatique sinon
      "config": {}               // optionnel : affiché dans le panneau de détails
    }
  ],
  "edges": [
    { "source": "chat", "target": "agent" },                 // flux principal (gauche → droite)
    { "source": "agent", "target": "model", "kind": "model" }, // sous-nœud sous l'agent
    { "source": "escalade", "target": "human", "label": "oui" }
  ]
}
```

Les nœuds `model`, `memory` et `tool` sont des sous-nœuds ronds branchés sous un nœud `agent`.
Le format est défini dans `lib/agent-graph.ts`.

## Structure

- `app/page.tsx` : page unique
- `components/agent-viewer/` : barre du haut, canvas, nœuds, panneau de détails
- `components/ai-elements/` : canvas, nœud et panneau repris du template
- `lib/agent-graph.ts` : types du JSON, validation, placement automatique
