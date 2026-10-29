from typing import Literal

from langchain_openai import ChatOpenAI

from app.config import get_settings


def chat_model(kind: Literal["strong", "fast"] = "strong") -> ChatOpenAI:
    """Strong model for drafting and code analysis; fast model for questions and self-checks."""
    settings = get_settings()
    model = settings.llm_model_fast if kind == "fast" and settings.llm_model_fast else settings.llm_model
    return ChatOpenAI(
        model=model,
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key or "missing",
        temperature=settings.llm_temperature,
        timeout=180,
        max_retries=2,
        default_headers={"HTTP-Referer": settings.frontend_url, "X-Title": settings.llm_app_name},
    )
