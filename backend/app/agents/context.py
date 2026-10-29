"""Context packs: what each agent reads before it starts.

The backend prepares the context deterministically (one place, cheap, testable) instead of
letting the model discover everything with tools. Tools stay available for follow-up details.
"""

import logging
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

from app import repo
from app.config import get_settings
from app.integrations import github
from app.integrations.atlassian import ISSUE_KEY, Confluence, Jira, format_issue, truncate
from app.integrations.workspace import Workspace
from app.models import ContextMapKind, Project, Source, StageId, UserStory

log = logging.getLogger(__name__)
URL = re.compile(r"https?://[^\s<>\"')]+")

# Context maps each agent reads, most important first.
STAGE_MAPS: dict[StageId, list[ContextMapKind]] = {
    "authoring": ["overview", "jira"],
    "refinement": ["overview", "jira", "confluence"],
    "specification": ["overview", "codebase"],
}
# The approved document each agent builds on.
PREVIOUS_STAGE: dict[StageId, StageId | None] = {"authoring": None, "refinement": "authoring", "specification": "refinement"}


# What build_context loads for each stage, shown on the Schéma page (GET /agents).
# `requires`: integration that must be connected, if any. Keep in sync with build_context below.
COMMON_INPUTS: list[dict[str, str | None]] = [
    {"name": "story", "label": "Fiche de l'US", "description": "Clé, type, priorité, projet, titre provisoire, epic parent.", "requires": None},
    {"name": "raw_requirement", "label": "Besoin brut", "description": "Le texte saisi à la création, liens compris.", "requires": None},
    {"name": "decisions", "label": "Journal de décisions", "description": "Réponses aux questions, refus, messages de chat et éditions manuelles, toutes étapes confondues.", "requires": None},
]
STAGE_INPUTS: dict[StageId, list[dict[str, str | None]]] = {
    "authoring": [
        {"name": "parent_epic", "label": "Epic parent", "description": "Résumé et description de l'epic, lus dans Jira.", "requires": "jira"},
        {"name": "linked_documents", "label": "Documents liés", "description": "Tickets Jira et pages Confluence cités dans le besoin.", "requires": "jira"},
        {"name": "similar_stories", "label": "Stories similaires", "description": "US proches dans l'app (et dans Jira si connecté), pour s'en différencier.", "requires": None},
    ],
    "refinement": [
        {"name": "approved_authoring_document", "label": "Brouillon approuvé", "description": "Le document To author validé par le PO/BA, éditions comprises.", "requires": None},
        {"name": "epic_siblings", "label": "Stories sœurs", "description": "Les autres stories de l'epic, pour éviter les doublons de critères.", "requires": "jira"},
        {"name": "confluence_hits", "label": "Pages Confluence", "description": "Les 3 pages les plus proches du titre, pour les règles métier.", "requires": "confluence"},
    ],
    "specification": [
        {"name": "approved_refinement_document", "label": "Refinement approuvé", "description": "Règles métier et critères Given/When/Then validés.", "requires": None},
        {"name": "repository_tree", "label": "Arborescence du repo", "description": "3 niveaux de dossiers du repo lié (local ou GitHub).", "requires": "repo"},
        {"name": "key_files", "label": "Fichiers clés", "description": "README, AGENTS.md, package.json, pyproject.toml…", "requires": "repo"},
        {"name": "recent_commits", "label": "Commits récents", "description": "Les 10 derniers commits du repo.", "requires": "repo"},
    ],
}


@dataclass
class ContextPack:
    sections: list[tuple[str, str]] = field(default_factory=list)
    sources: list[Source] = field(default_factory=list)
    workspace: Path | None = None

    def add(self, name: str, text: str | None) -> None:
        if text and text.strip():
            self.sections.append((name, text.strip()))

    def source(self, tool: str, label: str, url: str | None = None) -> None:
        if not any(item.label == label for item in self.sources):
            self.sources.append(Source(tool=tool, label=label, url=url))

    def render(self) -> str:
        return "\n\n".join(f"<{name}>\n{text}\n</{name}>" for name, text in self.sections)


def links_of(story: UserStory) -> list[str]:
    found = URL.findall(story.raw)
    return list(dict.fromkeys([*story.context_links, *found]))


def similar_local(story: UserStory, need: str, limit: int = 5, threshold: float = 0.45) -> list[UserStory]:
    def score(other: UserStory) -> float:
        return SequenceMatcher(None, need.lower(), f"{other.title}\n{other.raw}".lower()).ratio()

    candidates = [other for other in repo.list_stories(story.project_id) if other.id != story.id]
    ranked = sorted(((score(other), other) for other in candidates), key=lambda item: item[0], reverse=True)
    return [other for value, other in ranked[:limit] if value >= threshold]


async def build_context(story: UserStory, stage: StageId) -> ContextPack:
    pack = ContextPack()
    project = repo.get_project(story.project_id)

    header = [f"Key: {story.key}", f"Type: {story.type}", f"Priority: {story.priority}", f"Project: {project.name} ({project.key})"]
    if story.title:
        header.append(f"Working title: {story.title}")
    if story.parent_key:
        header.append(f"Parent epic: {story.parent_key}")
    pack.add("story", "\n".join(header))
    pack.add("raw_requirement", story.raw)

    if story.decisions:
        pack.add("decisions", "\n".join(f"- [{item.stage} · {item.kind}{' · ' + item.by if item.by else ''}] {item.text}" for item in story.decisions))

    if (previous := PREVIOUS_STAGE[stage]) and (output := story.stages.get(previous)):
        pack.add(f"approved_{previous}_document", output.markdown)
        for source in output.sources:
            pack.source(source.tool, source.label, source.url)

    maps = {item.kind: item for item in repo.context_maps(project.id)}
    for kind in STAGE_MAPS[stage]:
        item = maps.get(kind)
        if item and item.content:
            pack.add(f"context_map kind=\"{kind}\" status=\"{'validated' if item.validated else 'unverified'}\"", item.content)

    skills = [skill for skill in repo.skills(project.id) if skill.enabled]
    if skills:
        pack.add("skills", "\n".join(f"- {skill.name}: {skill.description}" for skill in skills))

    jira, confluence = Jira(), Confluence()
    try:
        if stage == "authoring":
            await _authoring(pack, story, project.jira_project_key, jira, confluence)
        elif stage == "refinement":
            await _refinement(pack, story, project.confluence_space_key, jira, confluence)
        elif stage == "specification":
            await _specification(pack, project)
    except Exception as error:  # A missing integration must not block the agent.
        log.warning("Context prefetch failed for %s/%s: %s", story.id, stage, error)
        pack.add("context_warnings", f"Part of the context could not be loaded: {error}")
    return pack


async def _authoring(pack: ContextPack, story: UserStory, jira_project: str | None, jira: Jira, confluence: Confluence) -> None:
    warnings: list[str] = []
    linked: list[str] = []
    if jira.enabled and story.parent_key:
        try:
            epic = await jira.get_issue(story.parent_key)
            pack.add("parent_epic", format_issue(epic))
            pack.source("Jira", story.parent_key, jira.browse_url(story.parent_key))
        except Exception as error:
            warnings.append(f"Parent epic {story.parent_key}: {error}")

    for url in links_of(story):
        try:
            if jira.enabled and (match := ISSUE_KEY.search(url)) and jira.url and url.startswith(jira.url):
                issue = await jira.get_issue(match.group(0))
                linked.append(format_issue(issue))
                pack.source("Jira", issue["key"], url)
            elif confluence.enabled and confluence.url and url.startswith(confluence.url):
                if page := await confluence.page_from_url(url):
                    linked.append(f"[Confluence] {page['title']}\n{page['text']}")
                    pack.source("Confluence", page["title"], page["url"])
            else:
                linked.append(f"[Link not read] {url}")
        except Exception as error:
            warnings.append(f"{url}: {error}")
    pack.add("linked_documents", truncate("\n\n---\n\n".join(linked), 12000))

    similar = [f"- {other.key} ({other.column}): {other.title}" for other in similar_local(story, story.raw)]
    if jira.enabled and jira_project:
        try:
            similar += [f"- {issue['key']} (Jira, {issue['status']}): {issue['summary']}" for issue in await jira.similar(story.raw, jira_project)]
        except Exception as error:
            warnings.append(f"Jira similar search: {error}")
    pack.add("similar_stories", "\n".join(similar))
    pack.add("context_warnings", "\n".join(warnings))


async def _refinement(pack: ContextPack, story: UserStory, space_key: str | None, jira: Jira, confluence: Confluence) -> None:
    warnings: list[str] = []
    if jira.enabled and story.parent_key:
        try:
            siblings = [issue for issue in await jira.epic_children(story.parent_key) if issue["key"] != story.key]
            pack.add("epic_siblings", "\n".join(f"- {issue['key']} ({issue['status']}): {issue['summary']}" for issue in siblings))
        except Exception as error:
            warnings.append(f"Epic siblings: {error}")
    if confluence.enabled:
        draft = story.drafts.get("authoring") or {}
        query = draft.get("title") or story.title or story.raw[:120]
        try:
            pages = await confluence.search(query, space_key, limit=3)
            pack.add("confluence_hits", "\n\n---\n\n".join(f"[{page['title']}] (id {page['id']})\n{page['text']}" for page in pages))
            for page in pages:
                pack.source("Confluence", page["title"], page["url"])
        except Exception as error:
            warnings.append(f"Confluence search: {error}")
    pack.add("context_warnings", "\n".join(warnings))


async def workspace_for(project: Project, refresh: bool = True) -> Path | None:
    """The repository the spec agent reads: a local path, or a GitHub clone kept in data/workspaces."""
    local = project.repo_path or (get_settings().local_repo_path if not project.github_repo else "")
    if local:
        path = Path(local).expanduser()
        return path if path.is_dir() else None
    if not project.github_repo:
        return None
    dest = get_settings().workspaces_dir / project.github_repo.replace("/", "__")
    token = repo.secret(f"github:{project.github_linked_by}") if project.github_linked_by else None
    if refresh and token:
        await github.sync_clone(project.github_repo, token, dest)
    return dest if (dest / ".git").exists() else None


async def _specification(pack: ContextPack, project: Project) -> None:
    path = await workspace_for(project)
    if not path:
        pack.add("context_warnings", "No repository is linked to this project (repo_path or github_repo): analyse from the context maps only and say so.")
        return
    workspace = Workspace(path)
    name = project.github_repo or path.name
    pack.workspace = path
    pack.add("repository_tree", f"Repository {name}\n{workspace.tree(depth=3, limit=250)}")
    pack.add("key_files", truncate(workspace.key_files(), 10000))
    pack.add("recent_commits", workspace.git_log(limit=10))
    pack.source("GitHub", name, f"https://github.com/{project.github_repo}" if project.github_repo else None)
