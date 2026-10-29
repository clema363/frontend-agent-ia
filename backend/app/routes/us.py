"""User story workflow: creation (To author) → refinement (To refine) → specification (To specify)."""

from fastapi import APIRouter, Depends, HTTPException, Request
from langgraph.types import Command

from app import repo
from app.agents.context import URL, similar_local
from app.agents.runner import Runner
from app.agents.stages import STAGES, StageSpec, stage_for_column
from app.auth import current_user
from app.models import (
    AnswersRequest,
    ChatMessage,
    DecideRequest,
    Decision,
    JournalEntry,
    MessageRequest,
    NewStoryRequest,
    PrecheckRequest,
    StageEditRequest,
    StageId,
    StageReview,
    User,
    UserStory,
)

router = APIRouter(prefix="/us", tags=["user stories"])


def runner(request: Request) -> Runner:
    return request.app.state.runner


def current_stage(story: UserStory) -> StageSpec:
    stage = stage_for_column(story.column)
    if not stage:
        raise HTTPException(409, f"No LangGraph agent for column {story.column} (Plan and Coding run in OpenCode)")
    return stage


def ensure_idle(story: UserStory, agents: Runner) -> None:
    if agents.busy(story.id) or story.agent_status == "working":
        raise HTTPException(409, "The agent is still working on this story")


def log(story: UserStory, user: User, action: str, detail: str | None = None, stage: StageId | None = None) -> None:
    current = stage_for_column(story.column)
    repo.log(JournalEntry(us_id=story.id, actor=user.name, action=action, stage=stage or (current.id if current else None), detail=detail))


@router.get("")
def list_stories(project: str | None = None, user: User = Depends(current_user)):
    return repo.list_stories(project)


@router.get("/journal")
def journal(us_id: str | None = None, user: User = Depends(current_user)):
    return sorted(repo.journal(us_id), key=lambda entry: entry.at, reverse=True)


@router.get("/stats")
def stats(user: User = Depends(current_user)):
    entries = repo.journal()
    return {
        "flagged_needs": sum(entry.action == "flagged-duplicate" for entry in entries),
        "created_despite_warnings": sum(entry.action == "created" and entry.detail == "despite duplicates" for entry in entries),
        "total_us": len(repo.list_stories()),
    }


@router.post("/precheck")
def precheck(body: PrecheckRequest, user: User = Depends(current_user)):
    probe = UserStory(id="", key="", title="", project_id=body.project, raw=body.need)
    return {"duplicates": similar_local(probe, body.need, threshold=0.6)}


@router.post("", status_code=201)
async def create(body: NewStoryRequest, request: Request, user: User = Depends(current_user)):
    repo.get_project(body.project)
    if not body.force:
        probe = UserStory(id="", key="", title="", project_id=body.project, raw=body.need)
        if duplicates := similar_local(probe, body.need, threshold=0.6):
            repo.log(JournalEntry(us_id=duplicates[0].id, actor=user.name, action="flagged-duplicate", detail=body.need[:200]))
            keys = ", ".join(item.key for item in duplicates)
            raise HTTPException(409, f"This requirement resembles {keys}.")
    us_id, key = repo.next_story_key()
    # The front appends the context links to the requirement; keep them in both places.
    links = list(dict.fromkeys([*body.context_links, *URL.findall(body.need)]))
    story = UserStory(
        id=us_id, key=key, type=body.issue_type_name or "Story", priority=body.priority, project_id=body.project,
        title=body.title or body.need.split("\n")[0][:80], parent_key=body.parent_key, raw=body.need, context_links=links,
    )
    repo.save_story(story)
    log(story, user, "created", "despite duplicates" if body.force else None)
    runner(request).start(story.id, "authoring", {"us_id": story.id})
    return repo.get_story(story.id)


@router.get("/{us_id}")
def get(us_id: str, user: User = Depends(current_user)):
    return repo.get_story(us_id)


@router.delete("/{us_id}", status_code=204)
def delete(us_id: str, user: User = Depends(current_user)):
    repo.get_story(us_id)
    repo.db.delete("us", us_id)


@router.post("/{us_id}/questions/{question_id}/answer")
async def answer(us_id: str, question_id: str, body: AnswersRequest, request: Request, user: User = Depends(current_user)):
    return _resume(us_id, question_id, body.answers, request, user)


@router.post("/{us_id}/questions/{question_id}/skip")
async def skip(us_id: str, question_id: str, request: Request, user: User = Depends(current_user)):
    return _resume(us_id, question_id, [], request, user)


def _resume(us_id: str, question_id: str, answers: list[list[str]], request: Request, user: User):
    story = repo.get_story(us_id)
    clarification = story.clarification
    if not clarification or clarification.id != question_id or clarification.answers is not None:
        raise HTTPException(409, "No pending questions")
    clarification.answers = answers
    for question, answer in zip(clarification.questions, answers):
        if answer:
            story.decisions.append(Decision(stage=clarification.stage, kind="answer", text=f"{question.question} → {', '.join(answer)}", by=user.role))
    repo.save_story(story)
    log(story, user, "answered questions" if answers else "skipped questions")
    # Skipped: one empty answer per question, so the graph sees "answered" and drafts with what it has.
    resume = answers or [[] for _ in clarification.questions]
    runner(request).start(us_id, clarification.stage, Command(resume=resume))
    return repo.get_story(us_id)


@router.post("/{us_id}/decide")
async def decide(us_id: str, body: DecideRequest, request: Request, user: User = Depends(current_user)):
    story = repo.get_story(us_id)
    stage = current_stage(story)
    agents = runner(request)
    ensure_idle(story, agents)
    output = story.stages.get(stage.id)
    if not output:
        raise HTTPException(409, "No document to review yet")
    if user.role not in stage.approvers:
        raise HTTPException(403, f"Only {' or '.join(stage.approvers)} can review the {stage.id} document")

    if body.decision == "refuse":
        if not (body.comment and body.comment.strip()):
            raise HTTPException(422, "A comment is required to request changes")
        output.review = StageReview(decision="rejected", by=user.role)
        story.decisions.append(Decision(stage=stage.id, kind="rejection", text=body.comment, by=user.role))
        repo.save_story(story)
        log(story, user, "refused", body.comment)
        agents.start(us_id, stage.id, {"us_id": us_id, "request": f"Changes requested by the {user.role}: {body.comment}"})
        return repo.get_story(us_id)

    output.review = StageReview(decision="approved", by=user.role)
    log(story, user, "approved")
    story.column = stage.next_column
    story.clarification = None
    repo.save_story(story)
    if next_stage := stage_for_column(story.column):
        agents.start(us_id, next_stage.id, {"us_id": us_id})
    return repo.get_story(us_id)


@router.post("/{us_id}/messages")
async def message(us_id: str, body: MessageRequest, request: Request, user: User = Depends(current_user)):
    story = repo.get_story(us_id)
    stage = current_stage(story)
    agents = runner(request)
    ensure_idle(story, agents)
    output = story.stages.get(stage.id)
    if not output:
        raise HTTPException(409, "No document yet")
    output.chat.append(ChatMessage(author="user", role=user.role, text=body.message))
    story.decisions.append(Decision(stage=stage.id, kind="chat", text=body.message, by=user.role))
    repo.save_story(story)
    log(story, user, "message", body.message)
    agents.start(us_id, stage.id, {"us_id": us_id, "request": f"Message from the {user.role}: {body.message}"})
    return repo.get_story(us_id)


@router.put("/{us_id}/stages/{stage_id}")
def edit_stage(us_id: str, stage_id: StageId, body: StageEditRequest, request: Request, user: User = Depends(current_user)):
    """Manual edit of a stage document (not wired in the front yet: edits stay local there)."""
    story = repo.get_story(us_id)
    ensure_idle(story, runner(request))
    output = story.stages.get(stage_id)
    if stage_id not in STAGES or not output:
        raise HTTPException(404, "No document for this stage")
    output.markdown, output.edited_by, output.review = body.markdown, user.role, None
    story.decisions.append(Decision(stage=stage_id, kind="edit", text="The document was edited by hand; the edited version is the reference.", by=user.role))
    repo.save_story(story)
    log(story, user, "edited", stage=stage_id)
    return story


@router.post("/{us_id}/retry")
async def retry(us_id: str, request: Request, user: User = Depends(current_user)):
    """Restart the current stage agent after a failure."""
    story = repo.get_story(us_id)
    stage = current_stage(story)
    agents = runner(request)
    if agents.busy(us_id):
        raise HTTPException(409, "The agent is still working on this story")
    pending = story.clarification and story.clarification.stage == stage.id and story.clarification.answers is None
    if pending:
        raise HTTPException(409, "The agent is waiting for answers to its questions")
    agents.start(us_id, stage.id, {"us_id": us_id})
    return repo.get_story(us_id)


@router.post("/{us_id}/submit")
def submit(us_id: str, user: User = Depends(current_user)):
    return repo.get_story(us_id)


@router.put("/{us_id}/fields")
def save_fields(us_id: str, body: dict, user: User = Depends(current_user)):
    story = repo.get_story(us_id)
    story.fields = body.get("fields", {})
    return repo.save_story(story)
