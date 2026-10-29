# Backend Atlas — agents To author → To refine → To specify

Premier jet du backend FastAPI + LangGraph. Il couvre la création d'une US jusqu'à la spécification, respecte le contrat du front (`src/api/endpoints.ts`, JSON en snake_case) et propose la connexion GitHub en OAuth. Les colonnes Plan et Coding restent à brancher sur OpenCode.

```sh
cd backend
cp .env.example .env      # renseigner au minimum LLM_API_KEY
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest             # parcours complet avec un faux LLM
```

Côté front : `VITE_API_MOCK=false` et `VITE_API_URL=http://localhost:8000` dans `.env.local`, puis relancer `npm run dev`.

**IA :** OpenRouter par défaut (`LLM_BASE_URL=https://openrouter.ai/api/v1`), avec `anthropic/claude-sonnet-5.5` pour rédiger et analyser le code, et `anthropic/claude-haiku-5.5` pour les questions et les relectures. N'importe quel modèle OpenRouter qui gère les *tools* fonctionne (par exemple `z-ai/glm-5.3`, moins cher). `POST /ai/test` vérifie la clé.

**Mode local (un seul utilisateur) :** avec `LOCAL_USER_EMAIL` renseigné, toute requête sans token est faite au nom de cet utilisateur, donc il n'y a pas besoin de se connecter. Pour approuver la spec, passe ton rôle à Architect ou DEV dans la page Profil. Pour l'agent de spec, `LOCAL_REPO_PATH` (ou `repo_path` sur un projet via `PATCH /projects/{id}`) indique un repo déjà présent sur ton disque, sans passer par GitHub. Les écrans Jira, Confluence et GitLab reçoivent des listes vides (`app/routes/workspace.py`).

## Le workflow

| Colonne | Agent | Il reçoit | Outils | Il produit |
| --- | --- | --- | --- | --- |
| To author | Authoring | Besoin brut, type, priorité, epic parent, contenu des liens Jira/Confluence, stories similaires, maps `overview` et `jira` | Jira, Confluence, skills | `AuthoringDraft` : titre, persona, objectif, bénéfice, contexte, périmètre, hypothèses. Pose d'abord jusqu'à 4 questions si un manque bloque. |
| To refine | Refinement | Draft *approuvé*, décisions, stories sœurs de l'epic, pages Confluence trouvées, maps `overview`, `jira`, `confluence` | Jira, Confluence, skills | `RefinementDraft` : règles métier BR1…, critères Given/When/Then reliés aux règles, cas limites, NFR, champs Jira suggérés |
| To specify | Spec | Refinement *approuvé*, décisions, arbre du repo, fichiers clés (README, manifests), commits récents, map `codebase` | `search_code`, `read_file`, `list_dir`, `git_log` sur un clone local, plus Jira/Confluence et skills | `SpecDraft` : comportement existant, fichiers impactés, faisabilité, conformité, libs, risques, stratégie de test |

Principes :

- **Le contexte est préparé par le backend** (`app/agents/context.py`), pas découvert par le modèle. Les outils ne servent qu'aux détails.
- **Seul le document approuvé passe à l'étape suivante**, avec le **journal de décisions** (`story.decisions`) : réponses aux questions, refus, messages de chat, éditions manuelles. Aucun agent ne repose une question déjà tranchée.
- **Sortie structurée (Pydantic)** via un outil `submit_document`, puis rendue en Markdown. La version structurée est gardée dans `story.drafts`.
- **Auto-vérification** avant qu'un humain voie le document : validateurs Python (chaque règle a un scénario ; chaque chemin cité existe dans le repo), puis un critique LLM rapide, puis une correction.
- **Révision ciblée** : un message de chat ou un refus relance le graphe de l'étape sur le même thread. L'agent modifie le document actuel, éditions manuelles comprises, et répond dans le chat (`reviewer_note`).

Le graphe est le même pour toutes les étapes (`app/agents/graph.py`) :

```
prepare → assess → ask ⏸ interrupt() → draft → check → fix → END
       └→ revise (feedback humain) ────────────↗
```

Un thread LangGraph par story et par étape (`us-118:refinement`). Les points de sauvegarde sont stockés dans `data/checkpoints.db`. Les questions utilisent `interrupt()`, et `POST /us/{id}/questions/{qid}/answer|skip` reprend le run avec `Command(resume=…)`.

## Routes

Routes du contrat du front : `/us`, `/us/{id}`, `/us/precheck`, `/us/journal`, `/us/stats`, `/us/{id}/decide`, `/us/{id}/messages`, `/us/{id}/questions/…`, `/us/{id}/fields`, `/projects`, `/projects/{id}/context`, `/projects/{id}/context/init|validate`, `/auth/me`, `/auth/demo`, `/auth/sso/status`, `/health`.

Routes ajoutées :

- `PUT /us/{id}/stages/{stage}` : enregistre une édition manuelle (côté front, les éditions restent locales pour l'instant).
- `POST /us/{id}/retry` : relance l'agent après un échec (`agent_status = failed`, avec `agent_error`).
- `GET|POST /projects/{id}/skills`, `PUT|DELETE /projects/{id}/skills/{skill_id}` : chaque agent voit les skills actifs (nom et description) et charge ceux qui s'appliquent avec `load_skill`.
- `GET /auth/github/login`, `GET /auth/github/callback`, `GET /github/repos`.
- `PATCH /projects/{id}` accepte `github_repo` (`owner/repo`).

Champs ajoutés à l'US : `agent_status` (`idle | working | needs-input | failed`), `agent_error`, `decisions`, `drafts`.

## Connexion GitHub (OAuth)

1. Créer une OAuth App sur https://github.com/settings/developers. Callback URL : `http://localhost:8000/auth/github/callback`.
2. Renseigner `GITHUB_CLIENT_ID` et `GITHUB_CLIENT_SECRET`.
3. Le bouton de connexion du front pointe vers `GET {API}/auth/github/login?redirect=/kanban`. Après autorisation, le backend redirige vers `{FRONTEND_URL}/kanban?token=<JWT>`, que le front lit déjà.
4. Lier un repo : `PATCH /projects/{id}` avec `{"github_repo": "owner/repo"}` (la liste est disponible via `GET /github/repos`). Le spec agent clone ce repo dans `data/workspaces/` avec le token de la personne qui l'a lié. Le token passe dans un en-tête HTTP et n'est jamais écrit dans `.git/config`.

En production : chiffrer les tokens (`repo.save_secret`), et passer à une **GitHub App** (droits par repo, tokens courts) plutôt qu'une OAuth App avec le scope `repo`.

## Contexte Jira

Voir `app/integrations/atlassian.py` et `app/agents/context_maps.py`. Le contexte Jira arrive à deux niveaux :

1. **Une fois par projet : la context map `jira`.** `POST /projects/{id}/context/init` avec `{"kinds": ["jira"]}` lit les métadonnées du projet (types, composants, priorités) et une douzaine de stories récentes. Le LLM en tire les conventions réelles de l'équipe (style des titres, structure, format des critères, glossaire). Un PO ou un BA la relit puis la valide (`/context/validate`). Tant qu'elle n'est pas validée, les agents la voient marquée `unverified`.
2. **Par story, au moment de l'exécution :** epic parent, tickets cités dans les liens, tickets similaires (JQL `text ~`) pour l'authoring ; stories sœurs de l'epic pour le refinement. Les agents ont aussi `jira_get_issue` et `jira_search` pour aller plus loin.

## Limites connues

- Stockage SQLite en documents JSON, credentials Jira/Confluence globaux (dans `.env`) : à remplacer par PostgreSQL et par les connexions par projet (`/jira/connections`…).
- Les runs tournent dans le processus de l'API (`asyncio.create_task`). Un redémarrage les marque `failed`, et il faut les relancer avec `/retry`. Pour la production, passer à une file de tâches (arq, Celery) ou à LangGraph Platform.
- Le contrôle des rôles se fait sur `me.role`, pas encore sur les rôles par projet.
- Après l'approbation de la spec, l'US passe dans Plan sans agent : c'est là qu'OpenCode doit être branché.
