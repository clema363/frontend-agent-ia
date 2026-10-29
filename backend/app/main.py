import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from app import db, repo
from app.agents.runner import Runner
from app.config import get_settings
from app.routes import agents, auth, projects, us, workspace

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    db.init(settings.db_path)
    # Runs do not survive a restart: unlock stories so the user can retry them.
    for story in repo.list_stories():
        if story.agent_status == "working":
            story.agent_status, story.agent_error = "failed", "Interrupted by a server restart"
            repo.save_story(story)
    async with AsyncSqliteSaver.from_conn_string(str(settings.checkpoints_path)) as checkpointer:
        app.state.runner = Runner(checkpointer)
        yield


app = FastAPI(title="Atlas agents", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_url],
    # Any local dev port (Vite picks another one when 5173 is taken).
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(us.router)
app.include_router(projects.router)
app.include_router(workspace.router)
app.include_router(agents.router)


@app.get("/health")
def health():
    settings = get_settings()
    return {"status": "ok", "llm_model": settings.llm_model, "llm_configured": bool(settings.llm_api_key)}
