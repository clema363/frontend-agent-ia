"""POST /projects/{id}/context/init: write the project context maps from Jira, Confluence and the repository.

Context maps are the long-lived, human-validated memory every agent reads. They are generated once,
validated by a PO/BA (or Architect/DEV for the codebase), then reused by every story of the project.
"""

from langchain_core.messages import HumanMessage, SystemMessage

from app import repo
from app.agents.context import workspace_for
from app.agents.llm import chat_model
from app.integrations.atlassian import Confluence, Jira, format_issue, truncate
from app.integrations.workspace import Workspace
from app.models import ContextMap, ContextMapKind, Project

INSTRUCTIONS: dict[ContextMapKind, str] = {
    "jira": """\
Write the Jira context map of this project for AI agents that write user stories. Markdown, max 400 words:
## Jira project — key, issue types used, workflow statuses, components.
## Writing conventions — inferred from the example stories: title style, description structure,
   acceptance criteria format, labels, how stories link to epics. Quote one short real example title.
## Glossary — business terms that recur in the stories, with a one-line definition when the examples give it.
Only state what the data shows.""",
    "confluence": """\
Write the Confluence context map of this project for AI agents that write user stories. Markdown, max 400 words:
## Business domain — what the space documents.
## Key pages — one line per important page: title (id) and what it is the reference for.
## Business rules and glossary — rules and terms stated in the excerpts.
Only state what the excerpts show.""",
    "codebase": """\
Write the codebase context map for AI agents that analyse user stories against this repository. Markdown, max 500 words:
## Stack — languages, frameworks, database, test tools (from the manifests).
## Main modules — top-level folders and what they contain, with paths.
## Conventions — architecture patterns, naming, where tests live, how to run them.
Only state what the files show.""",
    "overview": """\
Write the overview context map of this project for AI agents: Markdown, max 250 words.
## Project purpose — what the product does and for whom.
## Functional scope — main functional areas, one bullet each.
Base it on the other context maps below.""",
}


async def _source_material(project: Project, kind: ContextMapKind) -> str | None:
    if kind == "jira":
        jira = Jira()
        if not (jira.enabled and project.jira_project_key):
            return None
        meta = await jira.project_meta(project.jira_project_key)
        # Recently finished stories are the best evidence of the team's real conventions.
        examples = await jira.search(f'project = "{project.jira_project_key}" AND issuetype = Story ORDER BY updated DESC', limit=12)
        return f"Project metadata: {meta}\n\nExample stories:\n\n" + "\n\n---\n\n".join(format_issue(issue) for issue in examples)
    if kind == "confluence":
        confluence = Confluence()
        if not (confluence.enabled and project.confluence_space_key):
            return None
        pages = await confluence.space_pages(project.confluence_space_key)
        return "\n\n---\n\n".join(f"[{page['title']}] (id {page['id']})\n{page['text']}" for page in pages)
    if kind == "codebase":
        path = await workspace_for(project)
        if not path:
            return None
        workspace = Workspace(path)
        return f"Tree:\n{workspace.tree(depth=3)}\n\n{workspace.key_files()}"
    maps = [item for item in repo.context_maps(project.id) if item.kind != "overview" and item.content]
    return "\n\n".join(f"### {item.label}\n{item.content}" for item in maps) or f"Project name: {project.name}"


async def init_context_maps(project: Project, kinds: list[ContextMapKind] | None) -> list[ContextMap]:
    # Overview last: it summarises the others.
    order: list[ContextMapKind] = ["jira", "confluence", "codebase", "overview"]
    for kind in [kind for kind in order if not kinds or kind in kinds]:
        material = await _source_material(project, kind)
        if not material:
            continue
        response = await chat_model("strong").ainvoke([SystemMessage(INSTRUCTIONS[kind]), HumanMessage(truncate(material, 40000))])
        current = next(item for item in repo.context_maps(project.id) if item.kind == kind)
        repo.save_context_map(project.id, current.model_copy(update={"content": str(response.content).strip(), "validated": False}))
    return repo.context_maps(project.id)
