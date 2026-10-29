"""Sign-in: GitHub OAuth (the SSO of this first version) and demo accounts for local development.

GitHub flow:
  front → GET /auth/github/login?redirect=/kanban → github.com/login/oauth/authorize
  GitHub → GET /auth/github/callback?code&state → token exchange, user upsert, GitHub token saved
  backend → 302 {FRONTEND_URL}{redirect}?token=<app JWT>  (the front already reads ?token=)

The GitHub token is kept server-side and lets the spec agent clone the repositories this user links.
"""

from datetime import timedelta
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app import repo
from app.auth import current_user, issue_token, read_token
from app.config import get_settings
from app.integrations import github
from app.models import Role, User, new_id

router = APIRouter(prefix="/auth", tags=["auth"])

DEMO_ACCOUNTS: list[dict[str, Any]] = [
    {"email": "po@demo.local", "name": "Paula PO", "role": "PO"},
    {"email": "ba@demo.local", "name": "Bastien BA", "role": "BA"},
    {"email": "archi@demo.local", "name": "Ada Architect", "role": "Architect"},
    {"email": "dev@demo.local", "name": "Dev Dan", "role": "DEV"},
]


class MeUpdate(BaseModel):
    role: Role | None = None
    preferences: dict[str, Any] | None = None


class DemoLogin(BaseModel):
    role: Role | None = None
    email: str | None = None


def public(user: User) -> dict[str, Any]:
    return user.model_dump(exclude={"github_id"})


@router.get("/sso/status")
def sso_status():
    return {"enabled": get_settings().github_enabled, "provider": "github"}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return public(user)


@router.patch("/me")
def update_me(changes: MeUpdate, user: User = Depends(current_user)):
    if changes.role:
        user.role = changes.role
    if changes.preferences is not None:
        user.preferences = {**user.preferences, **changes.preferences}
    return public(repo.save_user(user))


@router.get("/demo/accounts")
def demo_accounts():
    return DEMO_ACCOUNTS if get_settings().demo_auth else []


@router.post("/demo")
def demo_login(body: DemoLogin):
    if not get_settings().demo_auth:
        raise HTTPException(403, "Demo sign-in is disabled")
    account = next((item for item in DEMO_ACCOUNTS if item["email"] == body.email or item["role"] == body.role), DEMO_ACCOUNTS[0])
    user = repo.find_user(lambda item: item.email == account["email"]) or repo.save_user(
        User(id=new_id("u"), name=account["name"], email=account["email"], role=account["role"], is_admin=True)
    )
    return {"access_token": issue_token(user.id), "user": public(user)}


@router.get("/github/login")
def github_login(redirect: str = "/"):
    if not get_settings().github_enabled:
        raise HTTPException(503, "GitHub OAuth is not configured (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)")
    if not redirect.startswith("/") or redirect.startswith("//"):
        redirect = "/"
    # Signed, short-lived state: protects the callback against CSRF without server-side sessions.
    state = issue_token("github-oauth", purpose="oauth-state", ttl=timedelta(minutes=10), redirect=redirect, nonce=new_id("n"))
    return RedirectResponse(github.authorize_url(state))


@router.get("/github/callback")
async def github_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    settings = get_settings()
    if error or not code or not state:
        return RedirectResponse(f"{settings.frontend_url}/login?{urlencode({'error': error or 'missing_code'})}")
    claims = read_token(state, purpose="oauth-state")
    try:
        token = await github.exchange_code(code)
        profile = await github.current_user(token)
    except Exception as failure:
        return RedirectResponse(f"{settings.frontend_url}/login?{urlencode({'error': str(failure)[:200]})}")

    user = repo.find_user(lambda item: item.github_id == profile["id"]) or repo.find_user(lambda item: item.email == profile["email"])
    user = user or User(id=new_id("u"), name=profile.get("name") or profile["login"], email=profile["email"])
    user.github_id, user.github_login = profile["id"], profile["login"]
    repo.save_user(user)
    repo.save_secret(f"github:{user.id}", token)
    return RedirectResponse(f"{settings.frontend_url}{claims['redirect']}?{urlencode({'token': issue_token(user.id)})}")
