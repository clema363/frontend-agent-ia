"""API models: same shapes as the front's src/lib/domain.ts, in snake_case."""

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

Role = Literal["PO", "BA", "Architect", "DEV", "QA"]
ROLES: list[Role] = ["PO", "BA", "Architect", "DEV", "QA"]
ColumnId = Literal["to-author", "to-refine", "to-specify", "review-for-dev", "coding"]
StageId = Literal["authoring", "refinement", "specification", "plan"]
IssueType = Literal["Story", "Epic", "Bug", "Task", "Spike"]
Priority = Literal["Low", "Medium", "High"]
SourceTool = Literal["Jira", "Confluence", "GitLab", "GitHub"]
ContextMapKind = Literal["overview", "codebase", "jira", "confluence"]
# Not in the front contract yet: lets the board tell "agent working" from "agent failed".
AgentStatus = Literal["idle", "working", "needs-input", "failed"]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}"


class Source(BaseModel):
    tool: SourceTool
    label: str
    url: str | None = None


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: new_id("m"))
    author: Literal["user", "agent"]
    role: Role | None = None
    text: str


class StageReview(BaseModel):
    decision: Literal["approved", "rejected"]
    by: Role


class StageOutput(BaseModel):
    markdown: str
    sources: list[Source] = []
    edited_by: Role | None = None
    review: StageReview | None = None
    chat: list[ChatMessage] = []


class AgentQuestionOption(BaseModel):
    label: str
    description: str | None = None


class AgentQuestion(BaseModel):
    question: str
    header: str
    options: list[AgentQuestionOption]
    multiple: bool = False
    custom: bool = True


class StoryClarification(BaseModel):
    id: str = Field(default_factory=lambda: new_id("q"))
    stage: StageId
    intro: str | None = None
    questions: list[AgentQuestion]
    answers: list[list[str]] | None = None


class Decision(BaseModel):
    """What humans decided along the way. Passed to every later agent so nobody asks twice."""

    stage: StageId
    kind: Literal["answer", "rejection", "chat", "edit"]
    text: str
    by: Role | None = None
    at: str = Field(default_factory=now)


class UserStory(BaseModel):
    id: str
    key: str
    type: IssueType = "Story"
    title: str
    priority: Priority = "Medium"
    project_id: str
    column: ColumnId = "to-author"
    parent_key: str | None = None
    raw: str
    context_links: list[str] = []
    stages: dict[StageId, StageOutput] = {}
    clarification: StoryClarification | None = None
    fields: dict[str, Any] | None = None
    my_roles: list[Role] | None = None
    # Backend additions.
    agent_status: AgentStatus = "idle"
    agent_error: str | None = None
    decisions: list[Decision] = []
    # Structured agent output per stage, rendered to `stages[stage].markdown`.
    drafts: dict[StageId, dict[str, Any]] = {}
    created_at: str = Field(default_factory=now)


class NewStoryRequest(BaseModel):
    need: str
    project: str
    priority: Priority = "Medium"
    force: bool = False
    issue_type_id: str | None = None
    issue_type_name: IssueType | None = None
    # Optional: the front currently appends links to `need`; URLs are extracted from it as well.
    title: str | None = None
    parent_key: str | None = None
    context_links: list[str] = []


class DecideRequest(BaseModel):
    decision: Literal["approve", "refuse"]
    comment: str | None = None


class AnswersRequest(BaseModel):
    answers: list[list[str]]


class MessageRequest(BaseModel):
    message: str


class StageEditRequest(BaseModel):
    markdown: str


class PrecheckRequest(BaseModel):
    need: str
    project: str


class JournalEntry(BaseModel):
    id: str = Field(default_factory=lambda: new_id("j"))
    us_id: str
    at: str = Field(default_factory=now)
    actor: str
    actor_type: Literal["user", "agent"] = "user"
    action: str
    stage: StageId | None = None
    detail: str | None = None
    model: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    duration_ms: int | None = None


class User(BaseModel):
    id: str
    name: str
    email: str
    is_admin: bool = False
    is_active: bool = True
    role: Role = "PO"
    preferences: dict[str, Any] = {}
    github_id: int | None = None
    github_login: str | None = None


class Project(BaseModel):
    id: str
    key: str
    name: str
    jira_project_key: str | None = None
    confluence_space_key: str | None = None
    gitlab_project_path: str | None = None
    # "owner/repo" read by the spec agent through the GitHub OAuth token of whoever linked it.
    github_repo: str | None = None
    github_linked_by: str | None = None
    # Local single-user mode: absolute path of a repository already on disk, read by the spec agent
    # instead of a GitHub clone.
    repo_path: str | None = None
    member_count: int = 1
    my_roles: list[Role] = ["PO", "BA", "Architect", "DEV", "QA"]
    user_stories: int = 0
    completed: int = 0


class ProjectSources(BaseModel):
    jira_project_key: str | None = None
    confluence_space_key: str | None = None
    gitlab_project_path: str | None = None
    github_repo: str | None = None
    repo_path: str | None = None


class ContextMap(BaseModel):
    kind: ContextMapKind
    label: str
    content: str = ""
    validated: bool = False
    validator_roles: list[Role]


class Skill(BaseModel):
    id: str = Field(default_factory=lambda: new_id("skill"))
    name: str
    description: str
    instructions: str
    enabled: bool = True
    source: Literal["ai", "manual"] = "manual"
    updated_at: str = Field(default_factory=now)


class SkillDraft(BaseModel):
    name: str
    description: str
    instructions: str
    enabled: bool = True
