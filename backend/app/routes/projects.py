"""Projects, their sources (Jira, Confluence, GitHub), context maps and skills."""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import repo
from app.agents.context_maps import init_context_maps
from app.auth import current_user
from app.config import get_settings
from app.integrations import github
from app.models import ContextMapKind, Project, ProjectSources, Skill, SkillDraft, User, new_id, now

router = APIRouter(tags=["projects"])


class NewProject(BaseModel):
    key: str
    name: str
    connection_id: str | None = None


class ContextInit(BaseModel):
    kinds: list[ContextMapKind] | None = None


class ContextValidate(BaseModel):
    kind: ContextMapKind
    content: str | None = None


def with_counts(project: Project) -> Project:
    stories = repo.list_stories(project.id)
    return project.model_copy(update={"user_stories": len(stories), "completed": sum(story.column in ("review-for-dev", "coding") for story in stories)})


@router.get("/projects")
def list_projects(user: User = Depends(current_user)):
    return [with_counts(Project.model_validate(item)) for item in repo.db.all("projects")]


@router.post("/projects", status_code=201)
def create_project(body: NewProject, user: User = Depends(current_user)):
    return repo.save_project(Project(id=new_id("p"), key=body.key, name=body.name, jira_project_key=body.key))


@router.patch("/projects/{project_id}")
def patch_project(project_id: str, sources: ProjectSources, user: User = Depends(current_user)):
    project = repo.get_project(project_id)
    changes = sources.model_dump(exclude_unset=True)  # null detaches a source
    if changes.get("github_repo"):
        if not repo.secret(f"github:{user.id}"):
            raise HTTPException(409, "Sign in with GitHub before linking a repository")
        # The spec agent clones the repository with the token of the user who linked it.
        changes["github_linked_by"] = user.id
    if changes.get("repo_path"):
        if not get_settings().local_user_email:
            raise HTTPException(403, "repo_path is only available in local single-user mode (LOCAL_USER_EMAIL)")
        if not Path(changes["repo_path"]).expanduser().is_dir():
            raise HTTPException(422, f"Not a directory: {changes['repo_path']}")
    return repo.save_project(project.model_copy(update=changes))


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, user: User = Depends(current_user)):
    repo.get_project(project_id)
    repo.db.delete("projects", project_id)


@router.get("/projects/{project_id}/context")
def context(project_id: str, user: User = Depends(current_user)):
    repo.get_project(project_id)
    return repo.context_maps(project_id)


@router.post("/projects/{project_id}/context/init")
async def init_context(project_id: str, body: ContextInit, user: User = Depends(current_user)):
    return await init_context_maps(repo.get_project(project_id), body.kinds)


@router.post("/projects/{project_id}/context/validate")
def validate_context(project_id: str, body: ContextValidate, user: User = Depends(current_user)):
    current = next(item for item in repo.context_maps(repo.get_project(project_id).id) if item.kind == body.kind)
    if user.role not in current.validator_roles:
        raise HTTPException(403, f"Only {' or '.join(current.validator_roles)} can validate this map")
    updated = current.model_copy(update={"content": body.content if body.content is not None else current.content, "validated": True})
    return repo.save_context_map(project_id, updated)


# Skills: name, description and instructions. Every agent sees the enabled ones and loads what applies.


@router.get("/projects/{project_id}/skills")
def list_skills(project_id: str, user: User = Depends(current_user)):
    return repo.skills(repo.get_project(project_id).id)


@router.post("/projects/{project_id}/skills", status_code=201)
def create_skill(project_id: str, draft: SkillDraft, user: User = Depends(current_user)):
    items = repo.skills(repo.get_project(project_id).id)
    skill = Skill(**draft.model_dump())
    repo.save_skills(project_id, [*items, skill])
    return skill


@router.put("/projects/{project_id}/skills/{skill_id}")
def update_skill(project_id: str, skill_id: str, draft: SkillDraft, user: User = Depends(current_user)):
    items = repo.skills(project_id)
    skill = next((item for item in items if item.id == skill_id), None)
    if not skill:
        raise HTTPException(404, "Skill not found")
    updated = skill.model_copy(update={**draft.model_dump(), "updated_at": now()})
    repo.save_skills(project_id, [updated if item.id == skill_id else item for item in items])
    return updated


@router.delete("/projects/{project_id}/skills/{skill_id}", status_code=204)
def delete_skill(project_id: str, skill_id: str, user: User = Depends(current_user)):
    repo.save_skills(project_id, [item for item in repo.skills(project_id) if item.id != skill_id])


@router.get("/github/repos")
async def github_repos(q: str | None = None, user: User = Depends(current_user)):
    token = repo.secret(f"github:{user.id}")
    if not token:
        raise HTTPException(409, "Sign in with GitHub first")
    return await github.list_repos(token, q)
