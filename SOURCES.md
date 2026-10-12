# Sources et projets à regarder

Notes personnelles : projets open source et outils qui ressemblent à une partie du projet (voir [PROJET.md](PROJET.md)).

## Création et refinement des user stories (Jira / Confluence)

- [JIRA-Refinement](https://github.com/KafraMan/JIRA-Refinement) : app Next.js qui importe des tickets Jira, les découpe en tâches et les réécrit en stories avec critères d'acceptation. Le plus proche de l'étape refinement.
- [atlassian_agent](https://github.com/danielvogler/atlassian_agent) : lit Confluence, améliore la description et la réécrit dans Jira.
- [aihub-core, issue #1891](https://github.com/bbvch-ai/aihub-core/issues/1891) : un agent qui s'appuie sur Confluence pour rédiger et relire des stories selon le modèle du projet Jira. Très proche de l'idée du projet.
- [agent-graph-jira](https://github.com/arielik/agent-graph-jira) : transforme une ébauche en story détaillée, avec critères d'acceptation et considérations techniques.
- [Custom-AI-Jira-Agent](https://github.com/lewisExternal/Custom-AI-Jira-Agent) : tri des tickets, création de stories et de critères d'acceptation.

## Spécification et plan d'implémentation (spec-driven development)

- [GitHub Spec Kit](https://github.com/github/spec-kit) : CLI open source, enchaîne `/specify`, `/clarify`, `/plan`, `/tasks`, `/implement`. Découpage très proche des étapes 2 à 4.
- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) : une équipe d'agents spécialisés (analyste, PM, architecte, développeur), un par étape.
- Kiro (Amazon, pas open source) : exigences → user stories → critères d'acceptation → conception → tâches. Référence d'interface pour l'étape spec.
- [Comparatif Spec Kit vs Kiro vs OpenSpec](https://levelop.dev/blog/spec-driven-development-tools-compared)
- [Guide Kiro / Spec Kit / BMAD](https://medium.com/@visrow/comprehensive-guide-to-spec-driven-development-kiro-github-spec-kit-and-bmad-method-5d28ff61b9b1)

## Code review sur GitLab

- [PR-Agent (Qodo)](https://github.com/qodo-ai/pr-agent) : référence open source de la review de merge requests, compatible GitLab.
- [gitlab-review-agent](https://github.com/antlss/gitlab-review-agent) : agent de review GitLab qui tient compte du contexte du dépôt.
- langgraph-harness ([article](https://dev.to/vrajpal-jhala/i-built-a-self-hosted-ai-agent-for-gitlab-it-has-reviewed-1000-merge-requests-2g7b)) : auto-hébergé, transforme une issue en brouillon de MR.

## Inspiration UI (Kanban avec agents)

- [Linear – Agents](https://linear.app/integrations/agents) : délégation d'un ticket à un agent, un humain reste responsable.
- [Multica](https://github.com/multica-ai/multica) : agents présentés comme des coéquipiers (profil, commentaires, blocages).
- [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) : une carte = une tâche confiée à un agent, suivi en direct et review du code.
- [AI Agent Board](https://github.com/DanWahlin/ai-agent-board) : Kanban minimaliste, on glisse une carte et on choisit l'agent.
- [Plane](https://plane.so) : alternative open source à Jira, création de tickets en langage naturel.
