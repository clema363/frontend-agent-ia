"""GitHub OAuth App flow, REST calls and local clones used by the spec agent."""

import asyncio
import base64
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import get_settings

API = "https://api.github.com"


def authorize_url(state: str) -> str:
    settings = get_settings()
    query = urlencode({
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_redirect_uri,
        "scope": settings.github_scopes,
        "state": state,
        "allow_signup": "false",
    })
    return f"https://github.com/login/oauth/authorize?{query}"


async def exchange_code(code: str) -> str:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
        )
        response.raise_for_status()
        data = response.json()
    if "access_token" not in data:
        raise ValueError(data.get("error_description") or data.get("error") or "GitHub refused the code")
    return data["access_token"]


async def _get(token: str, path: str, **params: Any) -> Any:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    async with httpx.AsyncClient(base_url=API, headers=headers, timeout=20) as client:
        response = await client.get(path, params=params)
        response.raise_for_status()
        return response.json()


async def current_user(token: str) -> dict[str, Any]:
    user = await _get(token, "/user")
    if not user.get("email"):
        emails = await _get(token, "/user/emails")
        primary = next((item for item in emails if item.get("primary") and item.get("verified")), None)
        user["email"] = primary["email"] if primary else f"{user['login']}@users.noreply.github.com"
    return user


async def list_repos(token: str, q: str | None = None) -> list[dict[str, Any]]:
    repos = await _get(token, "/user/repos", per_page=100, sort="pushed", affiliation="owner,collaborator,organization_member")
    items = [{"id": repo["id"], "path": repo["full_name"], "default_branch": repo["default_branch"], "private": repo["private"]} for repo in repos]
    return [item for item in items if not q or q.lower() in item["path"].lower()]


async def _git(*args: str, cwd: Path | None = None) -> None:
    process = await asyncio.create_subprocess_exec("git", *args, cwd=cwd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, stderr = await process.communicate()
    if process.returncode:
        raise RuntimeError(f"git {args[-2] if len(args) > 1 else args[0]} failed: {stderr.decode()[-500:]}")


async def sync_clone(repo: str, token: str, dest: Path) -> Path:
    """Shallow clone, or fast-forward an existing clone, of `owner/repo` into dest.

    The token goes through an HTTP header for this command only, so it never lands in .git/config.
    """
    basic = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    auth = ["-c", f"http.https://github.com/.extraheader=AUTHORIZATION: basic {basic}"]
    if (dest / ".git").exists():
        await _git(*auth, "fetch", "--depth", "50", "origin", cwd=dest)
        await _git("reset", "--hard", "origin/HEAD", cwd=dest)
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        await _git(*auth, "clone", "--depth", "50", f"https://github.com/{repo}.git", str(dest))
    return dest
