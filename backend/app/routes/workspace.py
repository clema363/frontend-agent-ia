"""Routes the front calls that have no real backend yet (no Jira, Confluence or GitLab connected).

They return neutral data so every screen loads; replace them as integrations are added.
"""

import time

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from app import repo
from app.agents.llm import chat_model
from app.auth import current_user
from app.config import get_settings
from app.models import ROLES, User

router = APIRouter(tags=["workspace"])

ISSUE_TYPES = [{"id": name.lower(), "name": name} for name in ("Story", "Epic", "Bug", "Task", "Spike")]


class UserUpdate(BaseModel):
    is_admin: bool | None = None
    is_active: bool | None = None


@router.post("/ai/test")
async def test_ai(user: User = Depends(current_user)):
    """Checks the OpenRouter key and model with a one-word call."""
    started = time.monotonic()
    try:
        await chat_model("fast").ainvoke([HumanMessage("Reply with OK.")])
    except Exception as error:
        raise HTTPException(502, f"LLM call failed: {error}") from error
    return {"ok": True, "model": get_settings().llm_model_fast or get_settings().llm_model, "latency_ms": int((time.monotonic() - started) * 1000)}


@router.get("/settings")
def get_settings_route(user: User = Depends(current_user)):
    settings = get_settings()
    saved = repo.db.get("settings", "app") or {}
    return {"jira_url": settings.jira_url, "confluence_url": settings.confluence_url, "gitlab_url": "", **saved}


@router.put("/settings")
def save_settings(changes: dict, user: User = Depends(current_user)):
    saved = {**(repo.db.get("settings", "app") or {}), **changes}
    repo.db.put("settings", "app", saved)
    return get_settings_route(user)


@router.get("/users")
def list_users(user: User = Depends(current_user)):
    return [User.model_validate(item).model_dump(exclude={"github_id"}) for item in repo.db.all("users")]


@router.patch("/users/{user_id}")
def update_user(user_id: str, changes: UserUpdate, user: User = Depends(current_user)):
    target = repo.get_user(user_id)
    if not target:
        raise HTTPException(404, "User not found")
    return repo.save_user(target.model_copy(update=changes.model_dump(exclude_none=True))).model_dump(exclude={"github_id"})


@router.get("/projects/{project_id}/members")
def members(project_id: str, user: User = Depends(current_user)):
    repo.get_project(project_id)
    return [{"user_id": user.id, "name": user.name, "email": user.email, "roles": ROLES}]


# Integrations not connected: empty lists, so source pickers simply show nothing.
for path in ("/jira/connections", "/confluence/connections", "/gitlab/connections", "/jira/projects", "/confluence/spaces", "/confluence/pages", "/gitlab/projects",
             "/projects/{project_id}/jira/fields", "/projects/{project_id}/jira/suggest/{kind}", "/us/{us_id}/opencode/messages"):
    router.add_api_route(path, lambda: [], methods=["GET"], include_in_schema=False)


@router.get("/projects/{project_id}/jira/issue-types")
def issue_types(project_id: str, user: User = Depends(current_user)):
    return ISSUE_TYPES


@router.get("/projects/{project_id}/jira/field-config")
def field_config(project_id: str, user: User = Depends(current_user)):
    return repo.db.get("field-config", project_id) or {"enabled_fields": [], "priority_mapping": {}, "jira_priorities": [], "catalogue": []}


@router.put("/projects/{project_id}/jira/field-config")
def save_field_config(project_id: str, body: dict, user: User = Depends(current_user)):
    return repo.db.put("field-config", project_id, {**field_config(project_id, user), **body})
