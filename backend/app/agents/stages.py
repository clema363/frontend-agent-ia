"""One entry per Kanban column handled by a LangGraph agent."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from app.agents import prompts
from app.agents.outputs import AuthoringDraft, Draft, RefinementDraft, SpecDraft
from app.models import ColumnId, Role, StageId

# Deterministic checks run before the LLM critic: cheap and never wrong.
Validator = Callable[[Draft, Path | None], list[str]]


def check_authoring(draft: AuthoringDraft, _: Path | None) -> list[str]:
    issues = []
    if len(draft.title) > 90:
        issues.append("The title is longer than 90 characters.")
    if not draft.in_scope:
        issues.append("In scope is empty.")
    return issues


def check_refinement(draft: RefinementDraft, _: Path | None) -> list[str]:
    proved = {rule_id for scenario in draft.acceptance_criteria for rule_id in scenario.rule_ids}
    issues = [f"Business rule {rule.id} has no scenario." for rule in draft.business_rules if rule.id not in proved]
    issues += [f"Scenario '{scenario.title}' is missing Given, When or Then." for scenario in draft.acceptance_criteria if not (scenario.given and scenario.when and scenario.then)]
    if len(draft.acceptance_criteria) < 2:
        issues.append("Fewer than two acceptance criteria: an error or edge case is missing.")
    return issues


def check_specification(draft: SpecDraft, workspace: Path | None) -> list[str]:
    issues = []
    if workspace:
        # Hallucinated paths are the most common spec failure: verify them against the clone.
        for area in draft.impacted_areas:
            exists = (workspace / area.path.lstrip("/")).exists()
            if area.change != "create" and not exists:
                issues.append(f"`{area.path}` does not exist in the repository (change '{area.change}'). Check the path with search_code or list_dir.")
    if draft.feasibility == "blocked" and not draft.open_questions:
        issues.append("The spec is blocked but lists no open question to unblock it.")
    return issues


@dataclass(frozen=True)
class StageSpec:
    id: StageId
    agent: str
    column: ColumnId
    next_column: ColumnId
    approvers: tuple[Role, ...]
    schema: type[Draft]
    system_prompt: str
    validator: Validator
    asks_questions: bool = False
    model: Literal["strong", "fast"] = "strong"
    uses_code: bool = False


STAGES: dict[StageId, StageSpec] = {
    "authoring": StageSpec(
        id="authoring", agent="Authoring agent", column="to-author", next_column="to-refine", approvers=("PO", "BA"),
        schema=AuthoringDraft, system_prompt=prompts.AUTHORING, validator=check_authoring, asks_questions=True,
    ),
    "refinement": StageSpec(
        id="refinement", agent="Refinement agent", column="to-refine", next_column="to-specify", approvers=("PO", "BA"),
        schema=RefinementDraft, system_prompt=prompts.REFINEMENT, validator=check_refinement,
    ),
    "specification": StageSpec(
        id="specification", agent="Spec agent", column="to-specify", next_column="review-for-dev", approvers=("Architect", "DEV"),
        schema=SpecDraft, system_prompt=prompts.SPECIFICATION, validator=check_specification, uses_code=True,
    ),
}


def stage_for_column(column: ColumnId) -> StageSpec | None:
    return next((stage for stage in STAGES.values() if stage.column == column), None)
