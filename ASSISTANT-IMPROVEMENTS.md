# Fiabiliser le Cockpit Assistant (chat LangGraph)

Ce document est un brief pour l'IA qui va modifier le backend du Cockpit Assistant. Il décrit le problème, ce qu'il faut changer, dans quel ordre, et comment savoir que c'est réussi.

Il a été écrit à partir de la documentation du projet (`shema/assistant-chat.html`), pas à partir du code. **Vérifie chaque nom de fichier, de fonction et d'outil dans le code avant de t'y fier**, et signale ce qui ne correspond pas.

## Le problème

L'assistant est un agent ReAct LangGraph : un seul nœud agent, un long prompt système, 9 outils, un modèle GLM derrière une passerelle compatible OpenAI (`ChatOpenAI`, `core/llm.py`). En pratique :

- il appelle souvent le mauvais outil (par exemple `list_stories` au lieu de `search_stories`) ;
- son raisonnement dérive après un tour d'outils (il « perd la question ») ;
- les blocs JSON qu'il doit écrire à la fin de ses réponses (` ```stories `, ` ```proposal `, ` ```usage `) sont parfois faux, incomplets ou suivis de texte.

La cause principale : on demande au modèle des choses que le code ferait de façon sûre (recopier des données, enchaîner des étapes obligatoires), et on lui laisse trop de choix à la fois (9 outils, un prompt plein de règles absolues, dont certaines se contredisent).

## L'objectif

Le modèle ne doit garder que ce qui demande du jugement : comprendre la demande, choisir un outil parmi deux ou trois, écrire une ou deux phrases. Tout le reste passe dans le graphe et dans le code.

Ce qui ne doit pas changer pour l'utilisateur : le chat répond dans sa langue, affiche les US en cartes cliquables, propose les créations avec une carte Create/Cancel, et ne crée jamais une US sans son clic.

## Ce qu'il ne faut pas toucher

- La chaîne HTTP et SSE (POST qui rend les ids, tâche de fond, flux rejouable, heartbeat, reconnexion).
- La borne de la boucle (`MAX_TOOL_ROUNDS = 6`, `RECURSION_LIMIT`).
- L'effort de raisonnement (`reasoning_effort: medium`) et `ReasoningChatOpenAI`.
- L'absence d'outil d'écriture : la création reste un clic de l'utilisateur sur l'endpoint de confirmation.
- Le nom de l'appelant et ses chapeaux fixés dans les schémas d'outils, et le cache de graphes.
- La télémétrie d'usage existante.

## Étape 0 : trouver d'où vient le problème (avant tout changement)

La doc dit que GLM « lit les tool results comme le tour humain », et qu'un rappel `[Reminder – the user question you are answering: …]` est injecté pour compenser. Ce symptôme ressemble à une passerelle qui transforme les messages de rôle `tool` en messages `user`.

1. Écris un petit script qui envoie à la passerelle une conversation avec un appel d'outil et son résultat (rôle `tool`, `tool_call_id`), et regarde ce que le modèle reçoit ou répond. Vérifie aussi que plusieurs appels d'outils dans un même tour fonctionnent.
2. Si un autre modèle est disponible sur la passerelle, rejoue quelques conversations ratées avec lui pour séparer « problème de modèle » et « problème de prompt ».

Rapporte le résultat. Ne retire pas le rappel de la question tant que la cause n'est pas corrigée.

## Étape 1 : un jeu de tests et des traces

Sans mesure, chaque correction risque d'en casser une autre.

- Enregistre pour chaque tour la trace complète : messages envoyés au modèle, appels d'outils avec leurs arguments, résultats, réponse finale. Le journal existant peut la porter, ou Langfuse hébergé en interne.
- Crée un jeu d'une quinzaine de questions types avec le comportement attendu, exécutable en une commande. Au minimum :

| Question | Attendu |
|---|---|
| « Quelles US attendent ma validation ? » | `list_stories(awaiting_me=true)` |
| « Montre toutes les US en review » | `list_stories` sur les colonnes `gate_*` |
| « Pourquoi US-101 est bloquée ? » | `get_story_history` |
| « Où en est le projet ? » | `board_summary` |
| « L'US sur le SSO » | `search_stories`, pas `list_stories` |
| « C'est quoi notre stack ? » | `read_context_cards`, aucun outil d'US |
| « Combien de tokens cette semaine ? » | `journal_usage(period=week)` |
| « Crée une US pour exporter en CSV » | branche création, proposition avec doublons, aucune US créée |
| « Crée deux US : A et B » | deux propositions, dans l'ordre |
| Besoin flou (« il faudrait améliorer le truc ») | une seule question de clarification |
| Question de suivi dont la réponse est déjà dans la conversation | aucune invention ; un nouvel appel d'outil est acceptable |
| Hors sujet (« écris-moi un poème ») | dit ce que l'assistant sait faire, aucun outil |

Lance ce jeu avant de commencer, pour avoir un point de départ, puis après chaque étape.

## Étape 2 : les cartes ne sont plus recopiées par le modèle

Aujourd'hui le modèle termine ses réponses par un bloc ` ```stories ` (tableau JSON `key, title, column, priority, jira_url, awaiting_answers`) et un bloc ` ```usage ` aux nombres « copiés verbatim ». C'est la tâche la plus fragile.

À la place :

- Le graphe streame déjà `updates` : quand un outil renvoie des US, garde-les côté serveur pour le tour en cours (l'option `response_format="content_and_artifact"` des outils LangChain sert à ça : le texte va au modèle, les données structurées restent côté code).
- Le modèle cite seulement les clés dans son texte (« US-101 et US-114 attendent ta validation »).
- À la fin du tour, le code repère les clés citées qui existent dans les résultats d'outils du tour, et envoie au front les cartes avec les vraies données. Une clé citée qui ne vient d'aucun outil n'est pas affichée en carte, et c'est à consigner dans la trace : c'est une invention.
- Pour l'usage, le résultat de `journal_usage` part directement à l'affichage ; le modèle n'écrit que la phrase d'introduction.

Choisis le transport le plus simple pour le front : soit un nouvel événement SSE typé, soit le backend ajoute lui-même le bloc ` ```stories ` au texte stocké, ce qui évite de toucher à `parseRawStream`. Dans les deux cas, le modèle n'écrit plus de JSON.

## Étape 3 : nettoyer les outils

- **Une seule façon de chercher.** `list_stories` a un filtre `search` sur le titre, et `search_stories` cherche par contenu : c'est la source de la confusion. Retire `search` de `list_stories` (il filtre par colonne, par file de review, avec une limite) et laisse la recherche à `search_stories`, qui couvre déjà le titre.
- **Fusionne** `journal_top_users` dans `journal_usage` (par exemple un paramètre `group_by`), sauf si le code montre une bonne raison de les garder séparés.
- **Réécris les descriptions pour le modèle.** Chaque description dit, dans cet ordre : ce que fait l'outil, quand l'utiliser, quand ne pas l'utiliser, ce qu'il renvoie, avec un exemple d'appel. Retire les détails d'implémentation qui n'aident pas à choisir (chemins de services, méthode de scoring, cas des admins sans membership).
- **Décris chaque paramètre** : format, valeurs possibles, valeur par défaut, exemple.
- **Allège les résultats** : seulement les champs utiles pour répondre, des listes courtes avec `total` pour signaler qu'il y en a plus.
- **Des erreurs qui disent quoi faire** : « Clé inconnue. Utilise search_stories pour trouver la bonne clé. » plutôt qu'un `{"error": ...}` nu.

## Étape 4 : un routeur et des branches

Remplace l'agent unique par un routeur suivi de branches spécialisées.

- **Routeur** : un appel au modèle en sortie structurée qui classe le dernier message, en tenant compte de la conversation : `board`, `project`, `usage`, `creation`, `off_topic`. En cas de doute, `board`.
- **Branches** : chacune a un prompt court et seulement ses outils.

| Branche | Outils | Rôle du modèle |
|---|---|---|
| `board` | `list_stories`, `search_stories`, `get_story`, `get_story_history`, `board_summary` | choisir l'outil, répondre en une ou deux phrases en citant les clés |
| `project` | `read_context_cards` | répondre à partir des cartes de contexte |
| `usage` | `journal_usage` | choisir la période, écrire une phrase |
| `creation` | aucun | voir l'étape 5 |
| `off_topic` | aucun | réponse fixe qui dit ce que l'assistant sait faire, sans appel au modèle |

Les branches `board`, `project` et `usage` gardent la boucle ReAct bornée actuelle.

## Étape 5 : la création en code

La création suit un processus strict ; il doit être porté par le graphe, pas par le prompt.

1. **Extraction** : le modèle rend en sortie structurée soit une question de clarification (une seule, courte, si le besoin est trop flou), soit une liste de `{need, title, priority}`, dans l'ordre demandé. `need` est le besoin tel que l'utilisateur l'a écrit.
2. **Doublons** : le code appelle le service de détection (`precheck_need`) pour chaque besoin. Ce n'est plus un outil du modèle.
3. **Proposition** : le code construit les cartes de proposition avec les doublons et les envoie au front dans le format que la carte Create/Cancel attend déjà. Le modèle peut écrire une phrase d'introduction, rien de plus.
4. **Attente** : la gate humaine existante attend le clic.
5. **Résultat** : après la création confirmée, le code produit un message fixe (l'US créée, sa carte, et le fait que l'agent d'authoring écrit la v1 dans la colonne To author). Plus de message « CREATE RESULT » envoyé au modèle.

`precheck_duplicates` sort de la liste d'outils, et la note « stories created earlier in this conversation » est conservée.

## Étape 6 : réécrire les prompts

Une fois les étapes 2 à 5 faites, il reste peu de choses à dire au modèle. Pour chaque prompt (routeur et branches) :

- Une seule langue pour les instructions (l'anglais ou le français, pas les deux), avec la consigne de répondre dans la langue de l'utilisateur.
- Des sections nommées : rôle, modèle du board, choix de l'outil, forme de la réponse.
- Pas de majuscules ni d'absolus en série (TOUJOURS, JAMAIS, STRICT). Explique la raison de chaque règle : par exemple « les clés citées sont transformées en cartes, donc ne cite que des clés renvoyées par un outil ».
- Garde le modèle du board, qui est utile : l'ordre des colonnes (`authoring, gate_po, refinement, gate_ba, specification, gate_design, packaging, gate_dev`), « en review » = toute colonne `gate_*`, « awaiting clarification » = `awaiting_answers=true`, et le fait qu'une US refusée avec commentaire compte encore dans la file de review.
- Supprime tout ce que le code fait désormais : les formats de blocs JSON, les étapes de création, « never call a creation tool », la règle « CREATE RESULT ».
- Supprime les contradictions de l'ancien prompt : « jamais d'US en bullets » contre « doublons en bullets avant les cartes » ; « reformuler le besoin » contre « need jamais reformulé » ; « toujours appeler un tool » contre « ne pas appeler de tools pour ce message ».
- Dis quoi faire dans les cas limites : outil en erreur, aucun résultat (le dire, ne rien inventer), demande ambiguë (une question courte), deux demandes dans le même message.
- Ajoute deux ou trois exemples complets par branche, variés, présentés comme des illustrations et non comme des modèles à recopier.

## Étape 7 : l'historique

La fenêtre garde les 20 derniers tours. Vérifie ce qu'elle contient : les anciens résultats d'outils (jusqu'à 4 000 caractères pour `get_story`) ne doivent pas y rester en entier. Remplace-les par une note compacte (les clés des US vues), comme c'est déjà fait pour les US créées.

## Ordre et critère de réussite

Fais les étapes dans l'ordre, une par une, en relançant le jeu de tests après chacune. Les étapes 2 et 3 apportent le plus pour le moins de code ; les étapes 4 et 5 sont le plus gros chantier.

C'est réussi quand :

- le jeu de tests passe, et de façon stable sur plusieurs exécutions ;
- aucune carte ne contient une donnée qui ne vient pas d'un outil ;
- la détection de doublons est exécutée pour chaque création, sans dépendre du modèle ;
- le prompt système de chaque branche tient en une page.

À la fin, rends un compte rendu : ce qui a été changé, le score du jeu de tests avant et après, ce que l'étape 0 a montré sur la passerelle, et ce qui reste fragile.
