"""Tools the stage agents can call. Each factory returns tools bound to one story's context
and records what the agent read, so the document's sources reflect its real research."""

import functools
from collections.abc import Awaitable, Callable
from pathlib import Path

from langchain_core.tools import BaseTool, StructuredTool

from app import repo
from app.agents.context import ContextPack
from app.integrations.atlassian import Confluence, Jira, format_issue, truncate
from app.integrations.workspace import Workspace

TOOL_OUTPUT_LIMIT = 8000

# One description per tool, grouped by what it needs. Also shown on the Schéma page (GET /agents).
TOOLS: dict[str, dict[str, str]] = {
    "jira": {
        "jira_get_issue": "Read one Jira issue (summary, description, links) by key, e.g. CASH-123.",
        "jira_search": "Search Jira with JQL, e.g. project = CASH AND text ~ \"rejected payment\". Returns keys and summaries.",
    },
    "confluence": {
        "confluence_search": "Full-text search in the project's Confluence space. Returns page ids and excerpts.",
        "confluence_get_page": "Read a whole Confluence page by id.",
    },
    "code": {
        "list_dir": "List a directory of the repository (relative path).",
        "search_code": "Case-insensitive regex search in the repository (ripgrep). Optional glob, e.g. '*.py' or 'src/**/*.ts'. Returns path:line:text.",
        "read_file": "Read a file by line range (default: first 300 lines). Lines are numbered.",
        "git_log": "Recent commits touching a path, to understand how and why it changed.",
    },
    "skills": {
        "load_skill": "Load the full instructions of a project skill listed in <skills>.",
    },
}


def _tool(group: str, function: Callable[..., Awaitable[str]]) -> BaseTool:
    name = function.__name__

    @functools.wraps(function)
    async def safe(**kwargs) -> str:
        try:
            return truncate(await function(**kwargs), TOOL_OUTPUT_LIMIT)
        except Exception as error:  # Let the model recover instead of failing the run.
            return f"Error: {error}"

    return StructuredTool.from_function(coroutine=safe, name=name, description=TOOLS[group][name])


def atlassian_tools(pack: ContextPack, space_key: str | None) -> list[BaseTool]:
    jira, confluence = Jira(), Confluence()
    tools: list[BaseTool] = []
    if jira.enabled:

        async def jira_get_issue(key: str) -> str:
            issue = await jira.get_issue(key)
            pack.source("Jira", key, jira.browse_url(key))
            return format_issue(issue)

        async def jira_search(jql: str) -> str:
            issues = await jira.search(jql, limit=10)
            return "\n".join(f"- {issue['key']} ({issue['type']}, {issue['status']}): {issue['summary']}" for issue in issues) or "No issue found."

        tools += [
            _tool("jira", jira_get_issue),
            _tool("jira", jira_search),
        ]
    if confluence.enabled:

        async def confluence_search(query: str) -> str:
            pages = await confluence.search(query, space_key, limit=5)
            return "\n\n".join(f"[{page['title']}] id={page['id']}\n{page['text'][:600]}" for page in pages) or "No page found."

        async def confluence_get_page(page_id: str) -> str:
            page = await confluence.get_page(page_id)
            pack.source("Confluence", page["title"], page["url"])
            return f"{page['title']}\n\n{page['text']}"

        tools += [
            _tool("confluence", confluence_search),
            _tool("confluence", confluence_get_page),
        ]
    return tools


def code_tools(pack: ContextPack, root: Path) -> list[BaseTool]:
    workspace = Workspace(root)

    async def list_dir(path: str = ".") -> str:
        return workspace.list_dir(path)

    async def search_code(pattern: str, glob: str | None = None) -> str:
        return workspace.search_code(pattern, glob)

    async def read_file(path: str, start: int = 1, end: int | None = None) -> str:
        content = workspace.read_file(path, start, end)
        if not content.startswith(("File not found", "File too large")):
            pack.source("GitHub", path)
        return content

    async def git_log(path: str = ".") -> str:
        return workspace.git_log(path)

    return [
        _tool("code", list_dir),
        _tool("code", search_code),
        _tool("code", read_file),
        _tool("code", git_log),
    ]


def skill_tools(project_id: str) -> list[BaseTool]:
    skills = {skill.name: skill for skill in repo.skills(project_id) if skill.enabled}
    if not skills:
        return []

    async def load_skill(name: str) -> str:
        skill = skills.get(name)
        return skill.instructions if skill else f"Unknown skill. Available: {', '.join(skills)}"

    return [_tool("skills", load_skill)]
