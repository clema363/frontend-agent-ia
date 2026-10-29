"""The LangGraph graph shared by every stage agent.

    START → prepare ─┬─ (new run, stage asks questions) → assess ─┬─ (gaps) → ask ⏸ interrupt → draft
                     │                                             └──────────────────────────→ draft
                     ├─ (new run) ──────────────────────────────────────────────────────────→ draft
                     └─ (human feedback) → revise
    draft / revise / fix → check ─┬─ (issues, rounds left) → fix
                                  └─────────────────────────→ END

One thread per story and stage (`{us_id}:{stage}`). A new run on a finished thread starts again from
START with the saved state, which is how chat messages and rejections become targeted revisions.
"""

import json
from pathlib import Path
from typing import Any, Literal, TypedDict, TypeVar

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import BaseTool
from langchain_core.utils.function_calling import convert_to_openai_tool
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt
from pydantic import BaseModel, ValidationError

from app import repo
from app.agents import prompts
from app.agents.context import ContextPack, build_context
from app.agents.llm import chat_model
from app.agents.outputs import Critique, GapAssessment
from app.agents.stages import StageSpec
from app.agents.tools import atlassian_tools, code_tools, skill_tools
from app.config import get_settings
from app.models import Source

SUBMIT = "submit_document"
T = TypeVar("T", bound=BaseModel)


class StageState(TypedDict, total=False):
    us_id: str
    context: str
    sources: list[dict[str, Any]]
    workspace: str | None
    # Questions asked before the first draft and the author's answers ([] when skipped or not needed).
    questions: dict[str, Any] | None
    answers: list[list[str]] | None
    draft: dict[str, Any] | None
    issues: list[str]
    rounds: int
    # Human feedback that triggers a revision, and the agent's reply to it.
    request: str | None
    reply: str | None


async def generate(
    schema: type[T],
    system: str,
    human: str,
    tools: list[BaseTool],
    config: RunnableConfig,
    max_steps: int | None = None,
    kind: Literal["strong", "fast"] = "strong",
) -> T:
    """Tool-calling loop that ends when the model submits a document matching `schema`.

    Submitting through a regular tool (tool_choice "auto") works with providers such as GLM
    that do not support forcing a tool; the forced structured output is only a last resort.
    """
    settings = get_settings()
    max_steps = settings.max_tool_steps if max_steps is None else max_steps
    submit = convert_to_openai_tool(schema)
    submit["function"].update(name=SUBMIT, description="Submit the complete final document.")
    by_name = {tool.name: tool for tool in tools}
    model = chat_model(kind)
    messages: list[BaseMessage] = [SystemMessage(system), HumanMessage(human)]

    for step in range(max_steps + 1):
        # Once the tool budget is spent, only submitting is allowed.
        available = [*tools, submit] if step < max_steps else [submit]
        ai = await model.bind_tools(available).ainvoke(messages, config)
        messages.append(ai)
        if not ai.tool_calls:
            messages.append(HumanMessage(f"Call {SUBMIT} with the complete document now."))
            continue
        for call in ai.tool_calls:
            if call["name"] == SUBMIT:
                try:
                    return schema.model_validate(call["args"])
                except ValidationError as error:
                    content = f"The document does not match the schema, fix it and submit again:\n{error}"
            elif tool := by_name.get(call["name"]):
                content = str(await tool.ainvoke(call["args"], config))
            else:
                content = f"Unknown tool {call['name']}."
            messages.append(ToolMessage(content, tool_call_id=call["id"]))

    # Some providers ignore tools now and then: force a structured answer as a last resort.
    structured = model.with_structured_output(schema, method=settings.llm_structured_method)
    return await structured.ainvoke([*messages, HumanMessage("Write the complete document now.")], config)


def build_graph(stage: StageSpec, checkpointer):
    def tools_for(state: StageState, pack: ContextPack) -> list[BaseTool]:
        story = repo.get_story(state["us_id"])
        project = repo.get_project(story.project_id)
        tools = [*atlassian_tools(pack, project.confluence_space_key), *skill_tools(project.id)]
        if stage.uses_code and state.get("workspace"):
            tools += code_tools(pack, Path(state["workspace"]))
        return tools

    def pack_of(state: StageState) -> ContextPack:
        return ContextPack(sources=[Source.model_validate(item) for item in state.get("sources", [])])

    def sources_of(pack: ContextPack) -> list[dict[str, Any]]:
        return [item.model_dump() for item in pack.sources]

    async def prepare(state: StageState) -> StageState:
        story = repo.get_story(state["us_id"])
        pack = await build_context(story, stage.id)
        return {
            "context": pack.render(),
            "sources": sources_of(pack),
            "workspace": str(pack.workspace) if pack.workspace else None,
            "issues": [],
            "rounds": 0,
            "reply": None,
        }

    def after_prepare(state: StageState) -> str:
        if state.get("request"):
            return "revise"
        if stage.asks_questions and state.get("answers") is None:
            return "assess"
        return "draft"

    async def assess(state: StageState, config: RunnableConfig) -> StageState:
        result = await generate(GapAssessment, prompts.QUESTIONS, state["context"], [], config, max_steps=1, kind="fast")
        if not result.questions:
            return {"questions": None, "answers": []}
        questions = [question.model_dump() for question in result.questions[:4]]
        return {"questions": {"intro": result.intro, "questions": questions}}

    def after_assess(state: StageState) -> str:
        return "ask" if state.get("questions") and state.get("answers") is None else "draft"

    def ask(state: StageState) -> StageState:
        # Pauses the run; POST /us/{id}/questions/{qid}/answer resumes it with Command(resume=answers).
        return {"answers": interrupt(state["questions"])}

    async def draft(state: StageState, config: RunnableConfig) -> StageState:
        pack = pack_of(state)
        human = state["context"]
        if (questions := state.get("questions")) and state.get("answers"):
            pairs = [f"- {q['question']} → {', '.join(answer) or 'skipped'}" for q, answer in zip(questions["questions"], state["answers"])]
            human += "\n\n<author_answers>\n" + "\n".join(pairs) + "\n</author_answers>"
        human += "\n\nWrite the document."
        document = await generate(stage.schema, stage.system_prompt, human, tools_for(state, pack), config)
        return {"draft": document.model_dump(), "sources": sources_of(pack)}

    async def revise(state: StageState, config: RunnableConfig) -> StageState:
        pack = pack_of(state)
        story = repo.get_story(state["us_id"])
        output = story.stages.get(stage.id)
        current = output.markdown if output else stage.schema.model_validate(state["draft"]).to_markdown()
        human = (
            f"{state['context']}\n\n<current_document>\n{current}\n</current_document>\n\n"
            f"<feedback>\n{state['request']}\n</feedback>\n\n{prompts.REVISION}"
        )
        document = await generate(stage.schema, stage.system_prompt, human, tools_for(state, pack), config)
        return {"draft": document.model_dump(), "sources": sources_of(pack), "reply": document.reviewer_note, "request": None}

    async def check(state: StageState, config: RunnableConfig) -> StageState:
        if state.get("rounds", 0) >= get_settings().max_self_check_rounds:
            return {"issues": []}
        document = stage.schema.model_validate(state["draft"])
        workspace = Path(state["workspace"]) if state.get("workspace") else None
        issues = stage.validator(document, workspace)
        review = await generate(
            Critique,
            f"{prompts.CRITIC}\n\n## Checklist\n{prompts.CHECKLISTS[stage.id]}",
            f"{state['context']}\n\n<document>\n{document.to_markdown()}\n</document>",
            [], config, max_steps=1, kind="fast",
        )
        return {"issues": [*issues, *review.issues]}

    def after_check(state: StageState) -> str:
        return "fix" if state.get("issues") else END

    async def fix(state: StageState, config: RunnableConfig) -> StageState:
        pack = pack_of(state)
        previous = stage.schema.model_validate(state["draft"])
        human = (
            f"{state['context']}\n\n<current_document>\n{json.dumps(state['draft'], ensure_ascii=False)}\n</current_document>\n\n"
            "<self_review>\n" + "\n".join(f"- {issue}" for issue in state["issues"]) + "\n</self_review>\n\n"
            "Fix every problem from the self-review and submit the full corrected document. Keep reviewer_note unchanged."
        )
        document = await generate(stage.schema, stage.system_prompt, human, tools_for(state, pack), config, max_steps=4)
        document.reviewer_note = previous.reviewer_note
        return {"draft": document.model_dump(), "sources": sources_of(pack), "rounds": state.get("rounds", 0) + 1}

    graph = StateGraph(StageState)
    for name, node in (("prepare", prepare), ("assess", assess), ("ask", ask), ("draft", draft), ("revise", revise), ("check", check), ("fix", fix)):
        graph.add_node(name, node)
    graph.add_edge(START, "prepare")
    graph.add_conditional_edges("prepare", after_prepare, ["assess", "draft", "revise"])
    graph.add_conditional_edges("assess", after_assess, ["ask", "draft"])
    graph.add_edge("ask", "draft")
    graph.add_edge("draft", "check")
    graph.add_edge("revise", "check")
    graph.add_conditional_edges("check", after_check, ["fix", END])
    graph.add_edge("fix", "check")
    return graph.compile(checkpointer=checkpointer, name=stage.agent)
