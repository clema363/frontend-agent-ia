# Présentation du projet

## En une phrase

Une application qui accompagne une user story de sa création jusqu'au plan d'implémentation : des agents IA aident les PO et BA à l'écrire, à l'affiner, à la confronter au code existant, puis produisent un plan prêt à être envoyé à une IA de développement.

## À qui ça s'adresse

- **PO / BA** : rédaction et amélioration des user stories.
- **Développeurs / tech leads** : vérification de la faisabilité technique et plan d'implémentation.

## Le parcours d'une user story

L'application est organisée en quatre étapes successives.

### 1. Création (« New US » puis « To author »)

Le PO ou le BA crée une US comme dans Jira : type (story, epic, bug, task, spike), projet, priorité, epic parente, titre facultatif. L'essentiel est le besoin saisi **en brut**, avec d'éventuels liens de contexte (Jira, Confluence). L'agent de rédaction retravaille ce texte brut pour en faire un premier brouillon propre.

### 2. Refinement

L'agent reprend le brouillon et le rend propre : critères d'acceptation au format Given / When / Then, règles métier, etc.

### 3. Spécification

L'agent produit un document Markdown en s'appuyant sur Jira, Confluence et GitLab. Il confronte la user story au code existant :

- est-ce qu'elle respecte la spécification et ce qui existe déjà ;
- est-ce qu'elle est réalisable dans le code actuel ;
- quelles bibliothèques peuvent être utilisées ;
- quels points d'attention au niveau du code.

### 4. Code review et plan d'implémentation

L'agent produit un plan d'implémentation qui peut être envoyé directement à une IA de développement pour réaliser la story.

```
Création → Refinement → Spécification → Code review / plan → IA de développement
```

### Validation à chaque étape

Chaque étape produit un document Markdown. Selon son rôle, la personne peut :

- valider le document (la story passe à l'étape suivante) ou le rejeter ;
- modifier le texte à la main ;
- demander une modification à l'agent via un chat.

Rôles qui valident : PO ou BA pour la création et le refinement, Architect ou DEV pour la spécification, DEV pour le plan.

## Intégrations

L'application se connecte à :

- **Jira** : les user stories et tickets.
- **GitLab** : le code source analysé lors des étapes de spécification et de code review.
- **Confluence** : la documentation et le contexte fonctionnel.

## Interface

L'interface s'inspire des outils de gestion de tickets comme Jira et Linear : un tableau Kanban où chaque colonne correspond à une étape du parcours et à son agent. Les cartes restent minimales ; un clic ouvre un panneau latéral redimensionnable avec un onglet par étape, la validation et le chat.

## État actuel

Seul le front-end existe pour l'instant (voir [README.md](README.md)). Les connexions à Jira, GitLab et Confluence ainsi que les agents restent à implémenter.
