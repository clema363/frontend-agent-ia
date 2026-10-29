"""Typed access to the document store."""

from fastapi import HTTPException

from app import db
from app.models import ContextMap, ContextMapKind, JournalEntry, Project, Role, Skill, User, UserStory

CONTEXT_MAPS: list[tuple[ContextMapKind, str, list[Role]]] = [
    ("overview", "Overview", ["PO", "BA"]),
    ("jira", "Jira", ["PO", "BA"]),
    ("confluence", "Confluence", ["PO", "BA"]),
    ("codebase", "Codebase", ["Architect", "DEV"]),
]


# Stories


def get_story(us_id: str) -> UserStory:
    data = db.get("us", us_id)
    if not data:
        raise HTTPException(404, "User story not found")
    return UserStory.model_validate(data)


def save_story(story: UserStory) -> UserStory:
    db.put("us", story.id, story.model_dump(mode="json"))
    return story


def list_stories(project_id: str | None = None) -> list[UserStory]:
    stories = [UserStory.model_validate(item) for item in db.all("us")]
    if project_id:
        stories = [story for story in stories if story.project_id == project_id]
    return sorted(stories, key=lambda story: story.created_at, reverse=True)


def next_story_key() -> tuple[str, str]:
    numbers = [int(story["key"].split("-")[-1]) for story in db.all("us") if story["key"].split("-")[-1].isdigit()]
    number = max(numbers, default=100) + 1
    return f"us-{number}", f"US-{number}"


# Journal


def log(entry: JournalEntry) -> JournalEntry:
    db.put("journal", entry.id, entry.model_dump(mode="json"))
    return entry


def journal(us_id: str | None = None) -> list[JournalEntry]:
    entries = [JournalEntry.model_validate(item) for item in db.all("journal")]
    return [entry for entry in entries if not us_id or entry.us_id == us_id]


# Projects, context maps and skills


def get_project(project_id: str) -> Project:
    data = db.get("projects", project_id)
    if not data:
        raise HTTPException(404, "Project not found")
    return Project.model_validate(data)


def save_project(project: Project) -> Project:
    db.put("projects", project.id, project.model_dump(mode="json"))
    return project


def context_maps(project_id: str) -> list[ContextMap]:
    saved = db.get("context", project_id) or {}
    return [
        ContextMap.model_validate(saved[kind]) if kind in saved else ContextMap(kind=kind, label=label, validator_roles=roles)
        for kind, label, roles in CONTEXT_MAPS
    ]


def save_context_map(project_id: str, context_map: ContextMap) -> ContextMap:
    saved = db.get("context", project_id) or {}
    saved[context_map.kind] = context_map.model_dump(mode="json")
    db.put("context", project_id, saved)
    return context_map


def skills(project_id: str) -> list[Skill]:
    return [Skill.model_validate(item) for item in (db.get("skills", project_id) or {}).get("items", [])]


def save_skills(project_id: str, items: list[Skill]) -> None:
    db.put("skills", project_id, {"items": [item.model_dump(mode="json") for item in items]})


# Users


def get_user(user_id: str) -> User | None:
    data = db.get("users", user_id)
    return User.model_validate(data) if data else None


def save_user(user: User) -> User:
    db.put("users", user.id, user.model_dump(mode="json"))
    return user


def find_user(predicate) -> User | None:
    for item in db.all("users"):
        user = User.model_validate(item)
        if predicate(user):
            return user
    return None


def secret(name: str) -> str | None:
    """Tokens are kept out of the user documents returned by the API. Encrypt them before production."""
    data = db.get("secrets", name)
    return data["value"] if data else None


def save_secret(name: str, value: str) -> None:
    db.put("secrets", name, {"value": value})
