# Insights : UI générée par l'IA (json-render)

La page `/insights` est un chat : on pose une question sur l'usage, l'agent répond par une phrase et un **spec json-render**, c'est-à-dire du JSON qui décrit l'UI. Le front le dessine avec ses propres composants. L'agent n'écrit jamais de code et ne peut utiliser que les composants du catalogue.

Pour l'instant, le front simule les réponses dans `src/lib/generative-ui/insights-demo.ts`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/generative-ui/catalog.ts` | Le catalogue : composants autorisés et leurs props (zod), plus les règles du prompt |
| `src/components/generative-ui/registry.tsx` | L'implémentation React de chaque composant (Recharts pour les graphiques) |
| `src/components/generative-ui/generative-ui.tsx` | Le `<GenerativeUI spec loading />` qui dessine un spec, même en cours de streaming |
| `src/lib/generative-ui/insights-demo.ts` | Les réponses simulées, à remplacer par l'appel au backend |
| `docs/generative-ui/insights-system-prompt.md` | Le prompt système généré à partir du catalogue, à donner au LLM |

Composants disponibles : `Stack`, `Grid`, `Card`, `Text`, `Metric`, `LineChart`, `BarChart`, `DonutChart`, `Table`, `Badge`.

## Brancher le backend

1. **Prompt système** : `npm run export:ui-prompt` régénère `insights-system-prompt.md` à partir du catalogue. Le backend le charge comme prompt système de l'agent insights. Il faut relancer la commande à chaque modification de `catalog.ts`.
2. **Outils** : l'agent a besoin d'outils qui renvoient les vraies données, par exemple `tokens_par_jour(debut, fin)`, `chats_par_personne(debut, fin)` ou `tokens_par_projet(semaines)`. Le prompt lui interdit d'inventer des chiffres : il met le résultat des outils dans `/state` et les props y renvoient avec `{ "$state": "/..." }`.
   - Attention, le prompt par défaut de json-render contient la phrase « Include realistic sample data in state ». Côté backend, il vaut mieux la retirer, ou renforcer la règle « Never invent numbers ».
3. **Stream** : le backend renvoie la phrase de réponse, puis le spec en **JSONL**, avec un patch RFC 6902 par ligne :
   ```jsonl
   {"op":"add","path":"/root","value":"root"}
   {"op":"add","path":"/elements/root","value":{"type":"Stack","props":{"gap":"md"},"children":["kpis"]}}
   {"op":"add","path":"/state/usage","value":{"daily":[{"day":"2026-11-03","input":412000,"output":98000}]}}
   ```
4. **Front** : dans `insights-page.tsx`, remplacer `simulateInsightsReply` par une lecture du stream qui passe chaque morceau à `createSpecStreamCompiler().push(chunk)`, puis met à jour `turn.spec` avec le résultat. Le reste ne change pas.

Pour mélanger texte et spec dans un même stream, `@json-render/core` fournit aussi `createJsonRenderTransform()` (mode inline).
