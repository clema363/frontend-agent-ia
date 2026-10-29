# Connaître l'existant sans donner le code aux étapes 1 et 2

Les étapes Authoring et Refinement n'ont pas accès au code, et Confluence est souvent obsolète.
Comment l'IA peut-elle savoir ce qui existe déjà (un bouton, un écran, une règle) ?
Les pages de contexte actuelles suffisent-elles ?

## 1. Ce que voient les agents aujourd'hui

D'après `backend/app/agents/context.py` (`STAGE_MAPS`) :

| Étape | Pages de contexte lues | Accès au code |
|---|---|---|
| Authoring (To author) | overview, jira | non |
| Refinement (To refine) | overview, jira, confluence | non |
| Specification | overview, codebase | oui (`list_dir`, `search_code`, `read_file`, `git_log`) |

Les pages de contexte actuelles ont trois limites :

- **La page `codebase` est technique.** Elle est générée à partir de l'arborescence du dépôt sur 3 niveaux et des
  fichiers clés (`backend/app/agents/context_maps.py`). Elle décrit la stack, les modules et les conventions, mais
  pas qu'il existe un bouton « Relancer » sur le détail d'un paiement.
- **Elle n'est pas transmise aux étapes 1 et 2.** Et même si elle l'était, elle ne contient pas l'information
  dont ces étapes ont besoin.
- **Elle vieillit comme Confluence.** Elle est générée une fois, validée, puis plus rien ne la remet à jour.

## 2. Ce que les étapes 1 et 2 doivent produire

Ne pas avoir le code au début est en partie voulu. Ces étapes décrivent le **quoi** et le **pourquoi** : qui est
concerné, quel problème, quelle valeur, quel comportement attendu. Le **où** et le **comment** (« ajouter un bouton
dans tel écran ») reviennent à la Specification, qui a le code.

- Bon critère d'acceptation : « Le trésorier peut relancer un paiement rejeté depuis son détail. »
- Mauvais critère d'acceptation : « Ajouter un bouton Relancer dans `PaymentDetail.tsx`. »

Il reste un vrai problème : pour bien cadrer, le PO doit savoir **ce qui existe déjà**. Sinon on rédige une story
pour une fonction qui existe, ou on rate une contrainte. C'est ce trou qu'il faut combler, sans pour autant donner
le code brut à ces étapes.

## 3. Comment gérer ça (par ordre de priorité)

### A. Une page « produit » générée depuis le code (le plus important)

Ajouter une 5ᵉ page de contexte, `product`, écrite en langage métier mais **produite à partir du code**, pas de
Confluence :

- **Écrans et routes**, avec pour chacun ce qu'on y voit et les actions possibles.
- **Rôles et droits** : qui peut faire quoi.
- **Règles métier lisibles dans le code** : statuts, validations, limites.
- **Pour chaque point, la source** (le chemin du fichier) et **le commit** qui a servi à générer la page.

Cette page est donnée à Authoring et à Refinement. Ainsi l'IA sait que le bouton existe sans jamais lire de code.
Elle n'est pas tentée de proposer une implémentation, et le prompt reste court.

**Pour qu'elle reste à jour :**

- La régénérer automatiquement après chaque merge sur `main`, ou au moins chaque semaine.
- Garder le commit dans la page.
- La repasser en `validated: false` quand le contenu change : le PO ne revalide que la différence.

### B. Une hiérarchie de confiance explicite dans les prompts

La règle actuelle (« Context marked `unverified` may be outdated ») va dans le bon sens. Il faut l'étendre avec un
ordre clair, du plus fiable au moins fiable :

**code > page produit générée du code > pages validées > Confluence > supposition**

- Si Confluence contredit la page produit, c'est la page produit qui fait foi, et l'agent signale l'écart.
- Afficher la date de dernière modification des pages Confluence citées, pour que l'IA et l'humain voient qu'une
  page date, par exemple, de 2023.

### C. Une section « Hypothèses sur l'existant », vérifiée ensuite en Specification

Ce que les étapes 1 et 2 ne savent pas avec certitude ne doit pas être affirmé. Ça va dans une section dédiée, par
exemple : « On suppose qu'il n'existe pas encore de relance manuelle ».

Ensuite, la **première tâche de l'agent Spec** est de vérifier chaque hypothèse dans le code :

- **Hypothèse confirmée** : on continue.
- **Hypothèse fausse** : l'agent le signale, une décision est enregistrée dans le journal de décisions, et la story
  peut revenir en Refinement si le périmètre change.

Toute erreur faite sans le code est alors rattrapée avant que les développeurs ne commencent.

### D. (Optionnel) Un outil limité `ask_product` pour les étapes 1 et 2

Un sous-agent qui a le code mais qui ne renvoie qu'une **réponse fonctionnelle avec une preuve**, par exemple :
« Oui, action "Relancer" sur le détail paiement, réservée aux trésoriers (source : `payments/detail`) ».

Ça couvre les cas que la page produit ne contient pas. En contrepartie, c'est plus coûteux et plus lent : à garder
pour plus tard.

### E. Laisser l'agent questionner le PO sur l'existant

Le prompt de questions interdit les questions techniques, et c'est bien. Mais « Cela existe-t-il déjà,
partiellement ? » est une question **fonctionnelle**, et le PO connaît souvent la réponse. Il faut la permettre
explicitement, uniquement quand la page produit ne répond pas.

## En résumé

Les pages de contexte telles qu'elles sont aujourd'hui ne suffisent pas. L'approche retenue est **A + B + C** :

1. La page produit apporte aux étapes 1 et 2 ce que le code sait, sans le code.
2. La hiérarchie de confiance empêche Confluence obsolète de passer pour la vérité.
3. La Specification vérifie toute hypothèse fausse avant le développement.

## Prochaines étapes d'implémentation

1. Page `product` : instructions de génération dans `backend/app/agents/context_maps.py`, ajout du type dans
   `ContextMapKind` (`backend/app/models.py`), ajout dans `STAGE_MAPS` pour Authoring et Refinement, mise à jour
   des fixtures de la maquette (`src/api/fixtures/context.json`, `src/api/fixtures/agents.json`).
2. Hiérarchie de confiance dans `shared_rules` (`backend/app/agents/prompts.py`).
3. Section « Hypothèses sur l'existant » dans les documents Authoring et Refinement, vérifiée en premier par
   l'agent Spec.
