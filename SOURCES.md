# Sources and projects to explore

Personal notes: open-source projects and tools that resemble parts of this project (see [PROJECT.md](PROJECT.md)).

## User story creation and refinement (Jira / Confluence)

- [JIRA-Refinement](https://github.com/KafraMan/JIRA-Refinement): Next.js app that imports Jira tickets, breaks them into tasks and rewrites them as stories with acceptance criteria. The closest match to the refinement stage.
- [atlassian_agent](https://github.com/danielvogler/atlassian_agent): reads Confluence, improves the description and rewrites it in Jira.
- [aihub-core, issue #1891](https://github.com/bbvch-ai/aihub-core/issues/1891): an agent that uses Confluence to write and review stories according to the Jira project's template. Very close to this project's concept.
- [agent-graph-jira](https://github.com/arielik/agent-graph-jira): turns a rough draft into a detailed story with acceptance criteria and technical considerations.
- [Custom-AI-Jira-Agent](https://github.com/lewisExternal/Custom-AI-Jira-Agent): ticket triage, story creation and acceptance criteria.

## Specification and implementation planning (spec-driven development)

- [GitHub Spec Kit](https://github.com/github/spec-kit): open-source CLI that chains `/specify`, `/clarify`, `/plan`, `/tasks`, `/implement`. Its workflow is very close to stages 2 through 4.
- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD): a team of specialized agents (analyst, PM, architect, developer), one per stage.
- Kiro (Amazon, not open source): requirements → user stories → acceptance criteria → design → tasks. An interface reference for the specification stage.
- [Spec Kit vs Kiro vs OpenSpec comparison](https://levelop.dev/blog/spec-driven-development-tools-compared)
- [Kiro / Spec Kit / BMAD guide](https://medium.com/@visrow/comprehensive-guide-to-spec-driven-development-kiro-github-spec-kit-and-bmad-method-5d28ff61b9b1)

## Code review on GitLab

- [PR-Agent (Qodo)](https://github.com/qodo-ai/pr-agent): an open-source reference for merge request reviews, compatible with GitLab.
- [gitlab-review-agent](https://github.com/antlss/gitlab-review-agent): GitLab review agent that takes repository context into account.
- langgraph-harness ([article](https://dev.to/vrajpal-jhala/i-built-a-self-hosted-ai-agent-for-gitlab-it-has-reviewed-1000-merge-requests-2g7b)): self-hosted tool that turns an issue into a draft MR.

## UI inspiration (Kanban with agents)

- [Linear – Agents](https://linear.app/integrations/agents): delegate a ticket to an agent while a human remains responsible.
- [Multica](https://github.com/multica-ai/multica): agents presented as teammates (profile, comments, blockers).
- [Vibe Kanban](https://github.com/BloopAI/vibe-kanban): one card per task assigned to an agent, with live tracking and code review.
- [AI Agent Board](https://github.com/DanWahlin/ai-agent-board): minimal Kanban board where you drag a card and choose an agent.
- [Plane](https://plane.so): open-source alternative to Jira with ticket creation in natural language.
