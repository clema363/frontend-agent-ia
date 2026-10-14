# Atlas — version Vue

Portage autonome du frontend Atlas avec **Vue 3, TypeScript, Vue Router, TanStack Vue Query, Pinia et shadcn-vue / Reka UI**.

Les dix pages, les routes, les données de démonstration, le client HTTP, la police Geist et les couleurs du projet d’origine sont repris. L’application React à la racine reste disponible pour comparaison.

## Démarrer

Depuis la racine du dépôt :

```sh
cd vue
npm ci
npm run dev
```

Node.js 22.12 ou supérieur est nécessaire. Vite affiche l’adresse locale. Pour choisir un port :

```sh
npm run dev -- --port 5174
```

## Architecture

- `src/main.ts` : initialisation de Vue, Pinia, Vue Query et Vue Router.
- `src/router.ts` : routes avec chargement des pages à la demande.
- `src/pages/*.tsx` : composants **Vue natifs** avec `defineComponent`, Composition API et rendu JSX compilé par `@vitejs/plugin-vue-jsx`. Ces fichiers n’utilisent ni React ni ses hooks.
- `src/components/layout/*.vue` et `src/components/ui/**/*.vue` : layout et composants shadcn-vue en Single File Components.
- `src/api/hooks.ts` : composables TanStack Vue Query, cache partagé, requêtes réactives, mutations et invalidations.
- `src/lib/theme.ts` : store Pinia pour le thème et les couleurs du Kanban, persistés sur cet appareil.
- `src/api/client.ts`, `endpoints.ts`, `mock-server.ts` et `fixtures/` : même contrat FastAPI et données que le projet d’origine.
- `src/index.css` : thème Tailwind, police Geist, tailles et couleurs d’origine.

Les données serveur appartiennent au cache Vue Query. Les formulaires utilisent des `ref` locaux et le thème appartient à Pinia. Les stories sont interrogées toutes les deux secondes lorsqu’un agent travaille. Les préférences se mettent à jour immédiatement et sont restaurées si la sauvegarde échoue.

Les filtres du Kanban et du journal sont conservés dans l’URL. Les validations demandent une confirmation et les changements de rôle rechargent les données qui dépendent des permissions.

## Backend

Le mode démo est activé par défaut et se réinitialise au rechargement. Pour utiliser le backend : copier `.env.example` dans `.env.local`, renseigner `VITE_API_URL` et choisir `VITE_API_MOCK=false`.

Le client conserve la conversion snake_case / camelCase et les JWT. Ce dépôt ne contient pas le backend FastAPI. Comme dans le projet d’origine, le formulaire de connexion est une démonstration et les modifications de documents restent locales jusqu’à l’existence d’un endpoint de sauvegarde.

## Vérifications

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Les tests unitaires couvrent le partage du cache, les requêtes conditionnelles et réactives, les invalidations après création/changement de rôle et le retour arrière des préférences en cas d’erreur.

Pour les tests navigateur :

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright lance un serveur temporaire ou réutilise celui du port 5174. Les tests couvrent les pages et onglets, les formulaires, les filtres, les validations, l’édition de documents, les champs Jira, le contexte, la suppression, le journal, le thème et le menu mobile.

## Ajouter un composant

```sh
npx shadcn-vue@latest add nom-du-composant
```

Les composants installés sont personnalisés pour reprendre le style Atlas. Préserver ces classes lors des mises à jour du registre.

En production, rediriger les routes inconnues vers `index.html` pour les liens directs avec Vue Router.

Documentation : [Vue JSX](https://vuejs.org/guide/extras/render-function.html), [shadcn-vue avec Vite](https://shadcn-vue.com/docs/installation/vite), [réactivité de TanStack Vue Query](https://tanstack.com/query/latest/docs/framework/vue/reactivity).
