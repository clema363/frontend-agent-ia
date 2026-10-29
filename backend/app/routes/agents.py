"""GET /agents: how the stage agents work, for the Schéma page. Read from the code, never duplicated."""

from fastapi import APIRouter, Depends

from app.agents import prompts
from app.agents.context import COMMON_INPUTS, STAGE_INPUTS, STAGE_MAPS
from app.agents.stages import STAGES
from app.agents.tools import TOOLS
from app.auth import current_user
from app.config import get_settings
from app.integrations.atlassian import Confluence, Jira
from app.models import User

router = APIRouter(tags=["agents"])

# The graph every stage agent runs (app/agents/graph.py).
GRAPH = [
    {"id": "prepare", "label": "Préparer le contexte", "description": "Le backend assemble le contexte de l'étape (aucun appel IA)."},
    {"id": "assess", "label": "Repérer les manques", "description": "Le modèle rapide décide s'il faut poser des questions (To author seulement)."},
    {"id": "ask", "label": "Poser les questions", "description": "Pause LangGraph (interrupt) jusqu'à ta réponse ou « Passer »."},
    {"id": "draft", "label": "Rédiger", "description": "Le modèle principal enquête avec ses outils, puis envoie le document via submit_document."},
    {"id": "revise", "label": "Réviser", "description": "Après un message de chat ou un refus : modifie le document actuel sans tout réécrire."},
    {"id": "check", "label": "Auto-vérifier", "description": "Règles Python, puis relecture par le modèle rapide avec la checklist de l'étape."},
    {"id": "fix", "label": "Corriger", "description": "Corrige les problèmes trouvés (une fois au maximum), avant que tu voies le document."},
]


@router.get("/agents")
def agents(user: User = Depends(current_user)):
    settings = get_settings()
    tools_for = lambda stage: ["jira", "confluence", "skills", *(["code"] if stage.uses_code else [])]  # noqa: E731
    return {
        "models": {"strong": settings.llm_model, "fast": settings.llm_model_fast or settings.llm_model},
        "integrations": {"jira": Jira().enabled, "confluence": Confluence().enabled, "github": settings.github_enabled, "local_repo": bool(settings.local_repo_path)},
        "graph": GRAPH,
        "prompts": {"shared_rules": prompts.SHARED_RULES, "questions": prompts.QUESTIONS, "critic": prompts.CRITIC, "revision": prompts.REVISION},
        "agents": [
            {
                "stage": stage.id,
                "name": stage.agent,
                "column": stage.column,
                "next_column": stage.next_column,
                "approvers": list(stage.approvers),
                "asks_questions": stage.asks_questions,
                "context_maps": STAGE_MAPS[stage.id],
                "inputs": [*COMMON_INPUTS, *STAGE_INPUTS[stage.id]],
                "tools": [{"name": name, "description": description, "requires": group} for group in tools_for(stage) for name, description in TOOLS[group].items()],
                "output": [
                    {"name": name, "description": field.description or ""}
                    for name, field in stage.schema.model_fields.items() if name != "reviewer_note"
                ],
                "system_prompt": stage.system_prompt,
                "checklist": prompts.CHECKLISTS[stage.id],
            }
            for stage in STAGES.values()
        ],
    }
