from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import repo
from app.config import get_settings
from app.models import User, new_id

bearer = HTTPBearer(auto_error=False)


def issue_token(user_id: str, purpose: str = "access", ttl: timedelta | None = None, **claims) -> str:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + (ttl or timedelta(hours=settings.jwt_ttl_hours))
    return jwt.encode({"sub": user_id, "purpose": purpose, "exp": expires, **claims}, settings.jwt_secret, algorithm="HS256")


def read_token(token: str, purpose: str = "access") -> dict:
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as error:
        raise HTTPException(401, "Invalid or expired token") from error
    if claims.get("purpose") != purpose:
        raise HTTPException(401, "Wrong token type")
    return claims


def local_user() -> User:
    settings = get_settings()
    user = repo.find_user(lambda item: item.email == settings.local_user_email)
    return user or repo.save_user(User(id=new_id("u"), name=settings.local_user_name, email=settings.local_user_email, is_admin=True))


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    if not credentials:
        if get_settings().local_user_email:
            return local_user()
        raise HTTPException(401, "Not signed in")
    try:
        user = repo.get_user(read_token(credentials.credentials)["sub"])
    except HTTPException:
        # Single-user mode: a stale token (e.g. the front's demo token) still opens the app.
        if get_settings().local_user_email:
            return local_user()
        raise
    if not user or not user.is_active:
        raise HTTPException(401, "Unknown or inactive user")
    return user
