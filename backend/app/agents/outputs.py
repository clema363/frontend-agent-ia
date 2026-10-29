"""Structured outputs of the stage agents.

Agents fill these schemas instead of writing free Markdown: the backend can validate them,
reuse fields (title, Jira fields) and render a consistent document for the front.
"""

from typing import Literal

from pydantic import BaseModel, Field


def bullets(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def section(title: str, body: str) -> str:
    return f"\n\n### {title}\n\n{body}" if body.strip() else ""


class Draft(BaseModel):
    reviewer_note: str = Field(
        "",
        description="Short message to the human reviewer: what you changed and why, or the answer to their question. Empty on a first draft.",
    )

    def to_markdown(self) -> str:
        raise NotImplementedError


# Questions asked before drafting (LangGraph interrupt → StoryClarification).


class QuestionOption(BaseModel):
    label: str = Field(description="1-4 words")
    description: str = Field(description="One short sentence explaining the consequence of this choice")


class Question(BaseModel):
    header: str = Field(description="Tab label, max 12 characters, e.g. 'Users'")
    question: str
    options: list[QuestionOption] = Field(description="2 to 4 plausible answers, most likely first")
    multiple: bool = Field(False, description="True if several options can apply at once")


class GapAssessment(BaseModel):
    blocking_gaps: list[str] = Field(description="Facts missing from the input that would change the story's scope or value. Empty if none.")
    intro: str = Field("", description="One sentence telling the author why you ask, in their language")
    questions: list[Question] = Field(description="At most 4 questions, only for blocking gaps. Empty list if you can write a good draft already.")


class Critique(BaseModel):
    issues: list[str] = Field(description="Concrete problems that must be fixed before a human reviews the document. Empty if it is ready.")


# To author


class AuthoringDraft(Draft):
    title: str = Field(description="Starts with a verb, max 80 characters, in the language of the requirement")
    persona: str = Field(description="Who benefits, as specific as the input allows (e.g. 'treasurer', not 'user')")
    goal: str = Field(description="What they want to do")
    benefit: str = Field(description="Why: the business outcome")
    context: str = Field(description="2-4 sentences: current situation, problem, why now. Only facts from the inputs.")
    in_scope: list[str] = Field(description="What this story covers")
    out_of_scope: list[str] = Field(description="Related things explicitly left for later stories")
    assumptions: list[str] = Field(description="Things you assumed without a source; the reviewer must confirm them")
    open_questions: list[str] = Field(description="Remaining questions for the PO/BA, not already answered in the decisions")

    def to_markdown(self) -> str:
        return (
            f"## {self.title}\n\nAs a **{self.persona}**, I want {self.goal} so that {self.benefit}."
            + section("Context", self.context)
            + section("In scope", bullets(self.in_scope))
            + section("Out of scope", bullets(self.out_of_scope))
            + section("Assumptions", bullets(self.assumptions))
            + section("Open questions", bullets(self.open_questions))
        )


# To refine


class BusinessRule(BaseModel):
    id: str = Field(description="BR1, BR2…")
    rule: str


class Scenario(BaseModel):
    title: str
    rule_ids: list[str] = Field(description="Business rules this scenario proves, e.g. ['BR1']")
    given: list[str]
    when: list[str]
    then: list[str]


class FieldSuggestion(BaseModel):
    field: str = Field(description="Jira field, e.g. Components, Labels, Story points")
    value: str
    reason: str


class RefinementDraft(Draft):
    title: str
    statement: str = Field(description="As a … I want … so that …")
    business_rules: list[BusinessRule]
    acceptance_criteria: list[Scenario] = Field(description="Given/When/Then, at least one per business rule, including error and edge cases")
    edge_cases: list[str]
    non_functional: list[str] = Field(description="Performance, security, accessibility, audit… only when relevant")
    out_of_scope: list[str]
    dependencies: list[str] = Field(description="Other stories, teams or systems this depends on")
    field_suggestions: list[FieldSuggestion]
    open_questions: list[str]

    def to_markdown(self) -> str:
        rules = "\n".join(f"- **{rule.id}** {rule.rule}" for rule in self.business_rules)
        scenarios = "\n\n".join(
            f"**Scenario: {scenario.title}**" + (f" _({', '.join(scenario.rule_ids)})_" if scenario.rule_ids else "")
            + "\n```gherkin\n"
            + "\n".join(
                f"{keyword if index == 0 else 'And'} {step}"
                for keyword, steps in (("Given", scenario.given), ("When", scenario.when), ("Then", scenario.then))
                for index, step in enumerate(steps)
            )
            + "\n```"
            for scenario in self.acceptance_criteria
        )
        fields = "\n".join(f"- **{item.field}**: {item.value} — {item.reason}" for item in self.field_suggestions)
        return (
            f"## {self.title}\n\n{self.statement}"
            + section("Business rules", rules)
            + section("Acceptance criteria", scenarios)
            + section("Edge cases", bullets(self.edge_cases))
            + section("Non-functional requirements", bullets(self.non_functional))
            + section("Out of scope", bullets(self.out_of_scope))
            + section("Dependencies", bullets(self.dependencies))
            + section("Suggested Jira fields", fields)
            + section("Open questions", bullets(self.open_questions))
        )


# To specify


class ImpactedArea(BaseModel):
    path: str = Field(description="Repository path you actually read or found with search_code")
    change: Literal["modify", "create", "delete", "read-only"]
    reason: str


class Library(BaseModel):
    name: str
    purpose: str
    already_used: bool = Field(description="True if it is already a dependency of the project")


class Risk(BaseModel):
    risk: str
    mitigation: str


class SpecDraft(Draft):
    summary: str = Field(description="What has to be built, in technical terms, in 3-5 sentences")
    existing_behavior: str = Field(description="How the code behaves today for this feature, with file references")
    impacted_areas: list[ImpactedArea]
    feasibility: Literal["feasible", "feasible-with-changes", "blocked"]
    feasibility_explanation: str
    conformity: list[str] = Field(description="Where the story contradicts existing behavior, documentation or conventions. Empty if none.")
    libraries: list[Library]
    data_changes: list[str] = Field(description="Schema, migration or storage changes")
    api_changes: list[str] = Field(description="New or changed endpoints, events or contracts")
    risks: list[Risk]
    test_strategy: list[str] = Field(description="How each acceptance criterion will be tested, and where tests live in this repository")
    open_questions: list[str]

    def to_markdown(self) -> str:
        verdict = {"feasible": "✅ Feasible", "feasible-with-changes": "⚠️ Feasible with changes", "blocked": "⛔ Blocked"}[self.feasibility]
        areas = "\n".join(f"| `{area.path}` | {area.change} | {area.reason} |" for area in self.impacted_areas)
        libraries = "\n".join(f"- **{lib.name}** — {lib.purpose}{' (already used)' if lib.already_used else ' (new dependency)'}" for lib in self.libraries)
        risks = "\n".join(f"- **{item.risk}** → {item.mitigation}" for item in self.risks)
        return (
            f"## Technical specification\n\n{self.summary}"
            + section("Feasibility", f"**{verdict}** — {self.feasibility_explanation}")
            + section("Existing behavior", self.existing_behavior)
            + section("Impacted code", f"| Path | Change | Why |\n| --- | --- | --- |\n{areas}" if areas else "")
            + section("Conformity with the existing", bullets(self.conformity))
            + section("Libraries", libraries)
            + section("Data changes", bullets(self.data_changes))
            + section("API changes", bullets(self.api_changes))
            + section("Risks", risks)
            + section("Test strategy", bullets(self.test_strategy))
            + section("Open questions", bullets(self.open_questions))
        )
