"""Jira and Confluence REST clients, reduced to what the agents read.

Cloud: email + API token (Basic auth). Data Center / Server: personal access token (Bearer).
Every function returns compact plain text or small dicts: agents should never see raw REST payloads.
"""

import html
import re
from typing import Any
from urllib.parse import unquote

import httpx

from app.config import get_settings

ISSUE_KEY = re.compile(r"\b[A-Z][A-Z0-9]+-\d+\b")
ISSUE_FIELDS = "summary,issuetype,status,priority,description,parent,labels,components,issuelinks,fixVersions"


def _client(base_url: str, email: str, token: str) -> httpx.AsyncClient:
    auth = httpx.BasicAuth(email, token) if email else None
    headers = {"Accept": "application/json", **({} if email else {"Authorization": f"Bearer {token}"})}
    return httpx.AsyncClient(base_url=base_url.rstrip("/"), auth=auth, headers=headers, timeout=20)


def html_to_text(value: str) -> str:
    value = re.sub(r"<(br|/p|/li|/h\d|/tr)[^>]*>", "\n", value)
    value = re.sub(r"<li[^>]*>", "- ", value)
    value = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"\n{3,}", "\n\n", html.unescape(value)).strip()


def truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[:limit] + "\n…[truncated]"


class Jira:
    def __init__(self) -> None:
        settings = get_settings()
        self.enabled = bool(settings.jira_url and settings.jira_token)
        self.cloud = bool(settings.jira_email)
        self.url = settings.jira_url.rstrip("/")
        self._args = (settings.jira_url, settings.jira_email, settings.jira_token)

    async def _get(self, path: str, **params: Any) -> Any:
        async with _client(*self._args) as client:
            response = await client.get(path, params=params)
            response.raise_for_status()
            return response.json()

    def browse_url(self, key: str) -> str:
        return f"{self.url}/browse/{key}"

    async def get_issue(self, key: str) -> dict[str, Any]:
        data = await self._get(f"/rest/api/2/issue/{key}", fields=ISSUE_FIELDS)
        return self._compact(data)

    async def search(self, jql: str, limit: int = 10) -> list[dict[str, Any]]:
        # Jira Cloud removed /search in favor of /search/jql; Data Center still uses /search.
        path = "/rest/api/2/search/jql" if self.cloud else "/rest/api/2/search"
        data = await self._get(path, jql=jql, maxResults=limit, fields=ISSUE_FIELDS)
        return [self._compact(issue) for issue in data.get("issues", [])]

    async def epic_children(self, epic_key: str, limit: int = 20) -> list[dict[str, Any]]:
        try:
            return await self.search(f'parent = "{epic_key}" ORDER BY created ASC', limit)
        except httpx.HTTPStatusError:
            # Older Data Center instances link stories to epics with the "Epic Link" field.
            return await self.search(f'"Epic Link" = "{epic_key}" ORDER BY created ASC', limit)

    async def similar(self, text: str, project_key: str, limit: int = 5) -> list[dict[str, Any]]:
        words = [word for word in re.findall(r"[\wÀ-ÿ]{4,}", text.lower())][:8]
        if not words:
            return []
        terms = " ".join(words).replace('"', "")
        return await self.search(f'project = "{project_key}" AND text ~ "{terms}" ORDER BY updated DESC', limit)

    async def project_meta(self, project_key: str) -> dict[str, Any]:
        data = await self._get(f"/rest/api/2/project/{project_key}")
        priorities = await self._get("/rest/api/2/priority")
        return {
            "name": data.get("name"),
            "issue_types": [item["name"] for item in data.get("issueTypes", [])],
            "components": [item["name"] for item in data.get("components", [])],
            "priorities": [item["name"] for item in priorities],
        }

    @staticmethod
    def _compact(issue: dict[str, Any]) -> dict[str, Any]:
        fields = issue.get("fields", {})
        description = fields.get("description") or ""
        if isinstance(description, dict):  # API v3 Atlassian Document Format
            description = _adf_to_text(description)
        return {
            "key": issue.get("key"),
            "type": (fields.get("issuetype") or {}).get("name"),
            "status": (fields.get("status") or {}).get("name"),
            "priority": (fields.get("priority") or {}).get("name"),
            "summary": fields.get("summary"),
            "description": truncate(description, 3000),
            "parent": (fields.get("parent") or {}).get("key"),
            "labels": fields.get("labels") or [],
            "components": [item["name"] for item in fields.get("components") or []],
            "links": [
                f"{link['type']['outward' if 'outwardIssue' in link else 'inward']} "
                f"{(link.get('outwardIssue') or link.get('inwardIssue') or {}).get('key')}"
                for link in fields.get("issuelinks") or []
            ],
        }


def _adf_to_text(node: dict[str, Any]) -> str:
    if node.get("type") == "text":
        return node.get("text", "")
    text = "".join(_adf_to_text(child) for child in node.get("content", []))
    return text + "\n" if node.get("type") in {"paragraph", "heading", "listItem"} else text


def format_issue(issue: dict[str, Any]) -> str:
    lines = [f"[{issue['key']}] {issue['type']} · {issue['status']} · {issue['summary']}"]
    for label, value in (("Parent", issue.get("parent")), ("Components", ", ".join(issue.get("components") or [])), ("Links", "; ".join(issue.get("links") or []))):
        if value:
            lines.append(f"{label}: {value}")
    if issue.get("description"):
        lines.append(issue["description"])
    return "\n".join(lines)


class Confluence:
    def __init__(self) -> None:
        settings = get_settings()
        self.enabled = bool(settings.confluence_url and settings.confluence_token)
        self.url = settings.confluence_url.rstrip("/")
        self._args = (settings.confluence_url, settings.confluence_email, settings.confluence_token)

    async def _get(self, path: str, **params: Any) -> Any:
        async with _client(*self._args) as client:
            response = await client.get(path, params=params)
            response.raise_for_status()
            return response.json()

    async def get_page(self, page_id: str, limit: int = 6000) -> dict[str, str]:
        data = await self._get(f"/rest/api/content/{page_id}", expand="body.storage,space")
        return self._compact(data, limit)

    async def find_page(self, space_key: str, title: str) -> dict[str, str] | None:
        data = await self._get("/rest/api/content", spaceKey=space_key, title=title, expand="body.storage,space")
        results = data.get("results", [])
        return self._compact(results[0], 6000) if results else None

    async def search(self, text: str, space_key: str | None = None, limit: int = 5) -> list[dict[str, str]]:
        query = text.replace('"', " ")
        cql = f'type = page AND text ~ "{query}"' + (f' AND space = "{space_key}"' if space_key else "")
        data = await self._get("/rest/api/content/search", cql=cql, limit=limit, expand="body.storage,space")
        return [self._compact(item, 1500) for item in data.get("results", [])]

    async def space_pages(self, space_key: str, limit: int = 15) -> list[dict[str, str]]:
        data = await self._get(
            "/rest/api/content/search", cql=f'space = "{space_key}" AND type = page ORDER BY lastmodified DESC', limit=limit, expand="body.storage,space"
        )
        return [self._compact(item, 1200) for item in data.get("results", [])]

    async def page_from_url(self, url: str) -> dict[str, str] | None:
        if match := re.search(r"(?:/pages/|pageId=)(\d+)", url):
            return await self.get_page(match.group(1))
        if match := re.search(r"/display/([^/]+)/([^/?#]+)", url):
            return await self.find_page(match.group(1), unquote(match.group(2)).replace("+", " "))
        return None

    def _compact(self, data: dict[str, Any], limit: int) -> dict[str, str]:
        body = html_to_text(data.get("body", {}).get("storage", {}).get("value", ""))
        return {
            "id": data["id"],
            "title": data.get("title", ""),
            "space": (data.get("space") or {}).get("key", ""),
            "url": f"{self.url}{data.get('_links', {}).get('webui', '')}",
            "text": truncate(body, limit),
        }
