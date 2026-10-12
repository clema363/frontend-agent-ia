# Frontend Agent IA — Atlas

Base React + Vite + TypeScript, avec Tailwind CSS, shadcn/ui, TanStack Query et React Router.

## Démarrer

Prérequis : Node.js 22.12+ (testé avec 22.23.1) et npm.

```sh
npm ci
npm run dev
```

Ouvrir l’adresse indiquée par Vite dans le terminal.

La page de connexion est disponible sur `/login`, également accessible via « Sign out » dans la sidebar. Elle utilise les composants shadcn/ui et reste une interface de démonstration : la soumission n’envoie aucun identifiant et affiche un message indiquant que la connexion n’est pas encore branchée. « Explore the demo » permet de revenir au dashboard.

## Données : fixtures ou vrai backend

Par défaut, l'app répond avec les fixtures JSON de `src/api/fixtures/` (rechargement = remise à zéro).
Les fixtures et le faux serveur suivent le contrat du backend : mêmes routes, mêmes corps, JSON en snake_case.
Pour appeler le FastAPI, créer `.env.local` à partir de `.env.example` avec `VITE_API_MOCK=false`.

`src/api/client.ts` convertit les clés snake_case ↔ camelCase et envoie le JWT (`Authorization: Bearer`),
lu depuis `localStorage` ou depuis `?token=` au retour du SSO.

## Vérifier et compiler

```sh
npm run lint
npm run typecheck
npm run build
npm run preview
```

## Organisation

- `src/pages/` : pages Dashboard, Projects (liste), Project (`/projects/:projectId/:tab?`), Kanban (`?project=` pour filtrer, `?view=list` pour la vue Liste), Journal (`?project=`, `?us=`, `?actor=`, `?action=` pour filtrer), Profile (`/profile`), Settings, Login et 404.
- `src/components/layout/` : layout, sidebar shadcn/ui et en-tête de page.
- `src/components/projects/` : onglets de la page projet (sources, membres, champs Jira, contexte) et pop-ups (nouveau projet, utilisateurs, suppression).
- `src/components/kanban/` : formulaire « New US », panneau de détail d'une user story (un onglet par étape, commentaires, validation, chat), session de l'IA de développement (`coding-agent.tsx`) et icônes de type, de priorité et d'étape.
- `src/components/markdown.tsx` : rendu des documents Markdown produits par les agents.
- `src/components/source-badge.tsx` : badges de source Jira, Confluence et GitLab.
- `src/components/ui/` : composants shadcn/ui modifiables dans le projet.
- `src/api/endpoints.ts` : une fonction par route du backend FastAPI.
- `src/api/hooks.ts` : hooks TanStack Query utilisés par les écrans.
- `src/api/client.ts` : appel HTTP vers le backend, ou vers le faux serveur selon `VITE_API_MOCK`.
- `src/api/mock-server.ts` et `src/api/fixtures/*.json` : faux backend en mémoire, mêmes routes que le FastAPI.
- `src/lib/domain.ts` : types échangés avec l'API et constantes du parcours.
- `src/lib/diff.ts` : diff ligne à ligne utilisé pour l'avant/après du refinement.
- `src/lib/story-workflow.ts` : correspondance entre colonnes et étapes.
- `src/lib/query-client.ts` : configuration du cache TanStack Query.
- `src/lib/utils.ts` : utilitaires de styles.
- `src/App.tsx` : déclaration des routes.
- `src/main.tsx` : providers React Router et TanStack Query.
- `src/index.css` : Tailwind et thème shadcn/ui.

L’alias `@/` pointe vers `src/`. TypeScript est configuré en mode strict.

Le front fonctionne seul en mode démonstration. Les appels API sont définis pour un backend FastAPI externe ; ce dépôt ne contient pas le backend. La page Profile affiche le compte connecté, ses projets et permet de changer son rôle via `PATCH /auth/me`.

Ajouter un composant :

```sh
npx shadcn@latest add input
```

En hébergement, rediriger les URLs inconnues vers `index.html` pour permettre le chargement direct des routes React Router.

Documentation : [shadcn/ui avec Vite](https://ui.shadcn.com/docs/installation/vite), [React Router](https://reactrouter.com/start/declarative/installation), [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview).
