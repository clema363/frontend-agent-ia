"""Runs stage graphs in the background and writes their results on the story."""

import asyncio
import logging
import time
from typing import Any

from langchain_core.callbacks import UsageMetadataCallbackHandler
from langgraph.types import Command

from app import repo
from app.agents.graph import build_graph
from app.agents.stages import STAGES, StageSpec
from app.config import get_settings
from app.models import ChatMessage, JournalEntry, StageId, StageOutput, StoryClarification

log = logging.getLogger(__name__)


class Runner:
    def __init__(self, checkpointer) -> None:
        self.graphs = {stage_id: build_graph(stage, checkpointer) for stage_id, stage in STAGES.items()}
        self._locks: dict[str, asyncio.Lock] = {}
        self._tasks: set[asyncio.Task] = set()

    def busy(self, us_id: str) -> bool:
        lock = self._locks.get(us_id)
        return bool(lock and lock.locked())

    def start(self, us_id: str, stage: StageId, payload: dict[str, Any] | Command) -> None:
        """Fire and forget: the board polls the story while agent_status is 'working'."""
        story = repo.get_story(us_id)
        story.agent_status, story.agent_error = "working", None
        repo.save_story(story)
        task = asyncio.create_task(self.run(us_id, stage, payload))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def run(self, us_id: str, stage_id: StageId, payload: dict[str, Any] | Command) -> None:
        stage = STAGES[stage_id]
        graph = self.graphs[stage_id]
        usage = UsageMetadataCallbackHandler()
        config = {"configurable": {"thread_id": f"{us_id}:{stage_id}"}, "callbacks": [usage], "recursion_limit": 40}
        started = time.monotonic()
        async with self._locks.setdefault(us_id, asyncio.Lock()):
            try:
                await graph.ainvoke(payload, config)
                snapshot = await graph.aget_state(config)
                self._persist(us_id, stage, snapshot, usage, started)
            except Exception as error:
                log.exception("Agent %s failed on %s", stage.agent, us_id)
                story = repo.get_story(us_id)
                story.agent_status, story.agent_error = "failed", str(error)[:500]
                repo.save_story(story)

    def _persist(self, us_id: str, stage: StageSpec, snapshot, usage: UsageMetadataCallbackHandler, started: float) -> None:
        story = repo.get_story(us_id)
        values = snapshot.values
        interrupts = [item for task in snapshot.tasks for item in task.interrupts]
        tokens_in = sum(item.get("input_tokens", 0) for item in usage.usage_metadata.values())
        tokens_out = sum(item.get("output_tokens", 0) for item in usage.usage_metadata.values())
        entry = dict(us_id=us_id, actor=stage.agent, actor_type="agent", stage=stage.id, model=get_settings().llm_model,
                     input_tokens=tokens_in, output_tokens=tokens_out, duration_ms=int((time.monotonic() - started) * 1000))

        if interrupts:
            payload = interrupts[0].value
            story.clarification = StoryClarification(stage=stage.id, intro=payload.get("intro"), questions=payload["questions"])
            story.agent_status = "needs-input"
            repo.save_story(story)
            repo.log(JournalEntry(**entry, action="asked questions", detail=f"{len(payload['questions'])} question(s)"))
            return

        document = stage.schema.model_validate(values["draft"])
        previous = story.stages.get(stage.id)
        chat = list(previous.chat) if previous else []
        if values.get("reply"):
            chat.append(ChatMessage(author="agent", text=values["reply"]))
        story.stages[stage.id] = StageOutput(markdown=document.to_markdown(), sources=values.get("sources", []), chat=chat)
        story.drafts[stage.id] = values["draft"]
        if stage.id == "authoring" and (title := values["draft"].get("title")):
            story.title = title
        story.agent_status, story.agent_error = "idle", None
        repo.save_story(story)
        repo.log(JournalEntry(**entry, action="generated", detail="revision" if previous else None))
