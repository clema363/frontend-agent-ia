from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from the environment or backend/.env (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # OpenRouter by default; any OpenAI-compatible endpoint works (OpenAI, Ollama, vLLM…).
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_api_key: str = ""
    # Strong model for drafting and code analysis, fast model for questions and self-checks.
    # Slugs: https://openrouter.ai/models (pick models that support tools).
    llm_model: str = "anthropic/claude-sonnet-5.5"
    llm_model_fast: str = "anthropic/claude-haiku-5.5"
    # Shown in the OpenRouter dashboard (optional attribution headers).
    llm_app_name: str = "Atlas"
    # function_calling works with most OpenAI-compatible providers; json_schema needs strict support.
    llm_structured_method: str = "function_calling"
    llm_temperature: float = 0.2

    data_dir: Path = Path("data")
    frontend_url: str = "http://localhost:5173"

    jwt_secret: str = "change-me"
    jwt_ttl_hours: int = 12
    # Allows POST /auth/demo (pick a role without OAuth). Turn off in production.
    demo_auth: bool = True
    # Single-user mode: requests without a token act as this local user. Turn off as soon as
    # several people use the app (then sign in with GitHub).
    local_user_email: str = ""
    local_user_name: str = "Me"
    # Local mode: repository the spec agent reads for projects without repo_path or github_repo.
    local_repo_path: str = ""

    # GitHub OAuth App: https://github.com/settings/developers
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/auth/github/callback"
    github_scopes: str = "read:user user:email repo"

    # Jira / Confluence. Cloud: email + API token (Basic). Data Center: leave the email empty, token = PAT (Bearer).
    jira_url: str = ""
    jira_email: str = ""
    jira_token: str = ""
    confluence_url: str = ""
    confluence_email: str = ""
    confluence_token: str = ""

    # Agent budgets.
    max_tool_steps: int = 8
    max_self_check_rounds: int = 1

    @property
    def db_path(self) -> Path:
        return self.data_dir / "atlas.db"

    @property
    def checkpoints_path(self) -> Path:
        return self.data_dir / "checkpoints.db"

    @property
    def workspaces_dir(self) -> Path:
        return self.data_dir / "workspaces"

    @property
    def github_enabled(self) -> bool:
        return bool(self.github_client_id and self.github_client_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
