"""End-to-end workflow with a scripted model: To author → To refine → To specify."""

import subprocess
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, ToolMessage

from app.agents.outputs import SpecDraft
from app.agents.stages import check_specification

DOCS = {
    "authoring": {
        "title": "Notify treasurers when a payment is rejected",
        "persona": "treasurer", "goal": "to be notified when the bank rejects a payment", "benefit": "I can fix it before the cut-off",
        "context": "Rejected payments are noticed too late.", "in_scope": ["E-mail notification"], "out_of_scope": ["SMS"],
        "assumptions": [], "open_questions": [],
    },
    "refinement": {
        "title": "Notify treasurers when a payment is rejected", "statement": "As a treasurer…",
        "business_rules": [{"id": "BR1", "rule": "Notify within 5 minutes"}],
        "acceptance_criteria": [
            {"title": "Rejected payment", "rule_ids": ["BR1"], "given": ["a payment"], "when": ["the bank rejects it"], "then": ["the treasurer gets an e-mail"]},
            {"title": "No treasurer", "rule_ids": ["BR1"], "given": ["no treasurer"], "when": ["the bank rejects it"], "then": ["the admin gets an e-mail"]},
        ],
        "edge_cases": [], "non_functional": [], "out_of_scope": [], "dependencies": [], "field_suggestions": [], "open_questions": [],
    },
    "specification": {
        "summary": "Send an e-mail from the payment status handler.", "existing_behavior": "`src/payments.py` updates the status only.",
        "impacted_areas": [{"path": "src/payments.py", "change": "modify", "reason": "emit the notification"}],
        "feasibility": "feasible", "feasibility_explanation": "Small change.", "conformity": [], "libraries": [],
        "data_changes": [], "api_changes": [], "risks": [], "test_strategy": ["Unit test the handler"], "open_questions": [],
    },
}


QUESTIONS = {
    "blocking_gaps": ["channel"], "intro": "One question first.",
    "questions": [{"header": "Channel", "question": "How should treasurers be notified?", "options": [
        {"label": "E-mail", "description": "Works everywhere."}, {"label": "In-app", "description": "Needs the app open."}]}],
}


def answer_for(system: str) -> dict:
    if system.startswith("You decide whether"):
        return QUESTIONS
    if system.startswith("You review a document"):
        return {"issues": []}
    return dict(DOCS[next(stage for stage in DOCS if system.startswith(f"You are the {stage} agent"))])


class FakeModel:
    def __init__(self, tools=()):
        self.tools = [tool["function"]["name"] if isinstance(tool, dict) else tool.name for tool in tools]

    def bind_tools(self, tools):
        return FakeModel(tools)

    async def ainvoke(self, messages, config=None):
        system = messages[0].content
        # The spec agent explores the code before submitting.
        if system.startswith("You are the specification agent") and "read_file" in self.tools and not any(isinstance(m, ToolMessage) for m in messages):
            return AIMessage("", tool_calls=[{"name": "read_file", "args": {"path": "src/payments.py"}, "id": "call-read"}])
        args = answer_for(system)
        if "<feedback>" in messages[1].content:
            args["reviewer_note"] = "Done: I added SMS to out of scope."
        return AIMessage("", tool_calls=[{"name": "submit_document", "args": args, "id": "call-submit"}])


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("JIRA_URL", "")
    monkeypatch.setenv("CONFLUENCE_URL", "")
    from app.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setattr("app.agents.graph.chat_model", lambda kind="strong": FakeModel())

    # A local clone, as the GitHub sync would leave it.
    repo_dir = tmp_path / "workspaces" / "acme__cash"
    (repo_dir / "src").mkdir(parents=True)
    (repo_dir / "src" / "payments.py").write_text("def on_status(payment):\n    payment.save()\n")
    (repo_dir / "README.md").write_text("# Cash\n")
    subprocess.run(["git", "init", "-q"], cwd=repo_dir, check=True)

    from app.main import app

    with TestClient(app) as test_client:
        token = test_client.post("/auth/demo", json={"role": "PO"}).json()["access_token"]
        test_client.headers["Authorization"] = f"Bearer {token}"
        yield test_client
    get_settings.cache_clear()


def wait(client: TestClient, us_id: str, until, timeout: float = 10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        story = client.get(f"/us/{us_id}").json()
        assert story["agent_status"] != "failed", story["agent_error"]
        if until(story):
            return story
        time.sleep(0.05)
    raise AssertionError(f"Timed out: {story}")


def test_story_goes_from_raw_requirement_to_spec(client):
    from app import repo

    project = client.post("/projects", json={"key": "CASH", "name": "Cash"}).json()
    repo.save_project(repo.get_project(project["id"]).model_copy(update={"github_repo": "acme/cash", "github_linked_by": "nobody"}))

    created = client.post("/us", json={"need": "when the bank rejects a payment notify the treasurer\nhttps://example.com/doc", "project": project["id"], "priority": "High"})
    assert created.status_code == 201
    story = created.json()
    assert story["context_links"] == ["https://example.com/doc"]

    # To author: the agent asks first, then drafts with the answer.
    story = wait(client, story["id"], lambda s: s["agent_status"] == "needs-input")
    clarification = story["clarification"]
    assert clarification["questions"][0]["header"] == "Channel"
    client.post(f"/us/{story['id']}/questions/{clarification['id']}/answer", json={"answers": [["E-mail"]]})
    story = wait(client, story["id"], lambda s: "authoring" in s["stages"] and s["agent_status"] == "idle")
    assert story["title"] == "Notify treasurers when a payment is rejected"
    assert "As a **treasurer**" in story["stages"]["authoring"]["markdown"]
    assert story["decisions"][0]["text"].endswith("→ E-mail")

    # Chat: a targeted revision with a reply in the panel.
    client.post(f"/us/{story['id']}/messages", json={"message": "Leave SMS out"})
    story = wait(client, story["id"], lambda s: len(s["stages"]["authoring"]["chat"]) == 2 and s["agent_status"] == "idle")
    assert story["stages"]["authoring"]["chat"][1]["text"].startswith("Done")

    # Approvals move the story and start the next agent.
    assert client.post(f"/us/{story['id']}/decide", json={"decision": "refuse"}).status_code == 422
    client.post(f"/us/{story['id']}/decide", json={"decision": "approve"})
    story = wait(client, story["id"], lambda s: "refinement" in s["stages"] and s["agent_status"] == "idle")
    assert story["column"] == "to-refine"
    assert "```gherkin\nGiven a payment" in story["stages"]["refinement"]["markdown"]

    client.post(f"/us/{story['id']}/decide", json={"decision": "approve"})
    story = wait(client, story["id"], lambda s: "specification" in s["stages"] and s["agent_status"] == "idle")
    assert story["column"] == "to-specify"
    spec = story["stages"]["specification"]
    assert "`src/payments.py`" in spec["markdown"]
    assert {"tool": "GitHub", "label": "src/payments.py", "url": None} in spec["sources"]

    # The spec stage needs an Architect or a DEV.
    assert client.post(f"/us/{story['id']}/decide", json={"decision": "approve"}).status_code == 403

    actions = [entry["action"] for entry in client.get("/us/journal", params={"us_id": story["id"]}).json()]
    assert actions.count("generated") == 4 and "asked questions" in actions


def test_similar_requirement_returns_409(client):
    project = client.post("/projects", json={"key": "CASH", "name": "Cash"}).json()
    need = {"need": "notify the treasurer when the bank rejects a payment", "project": project["id"]}
    assert client.post("/us", json=need).status_code == 201
    assert client.post("/us", json=need).status_code == 409
    assert client.post("/us", json={**need, "force": True}).status_code == 201


def test_spec_validator_flags_paths_missing_from_the_repository(tmp_path: Path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "real.py").write_text("")
    draft = SpecDraft.model_validate({**DOCS["specification"], "impacted_areas": [
        {"path": "src/real.py", "change": "modify", "reason": ""},
        {"path": "src/invented.py", "change": "modify", "reason": ""},
        {"path": "src/new.py", "change": "create", "reason": ""},
    ]})
    issues = check_specification(draft, tmp_path)
    assert len(issues) == 1 and "src/invented.py" in issues[0]


def test_local_mode_opens_the_app_without_signing_in(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LOCAL_USER_EMAIL", "me@local")
    from app.config import get_settings

    get_settings.cache_clear()
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/auth/me").json()["email"] == "me@local"
        # A stale token left by the front's demo mode still works.
        assert client.get("/auth/me", headers={"Authorization": "Bearer mock-token"}).status_code == 200
        project = client.post("/projects", json={"key": "ATL", "name": "Atlas"}).json()
        # Screens that would call Jira, Confluence or GitLab still load.
        for path in ("/settings", "/users", "/jira/connections", "/jira/projects", f"/projects/{project['id']}/members",
                     f"/projects/{project['id']}/jira/field-config", f"/projects/{project['id']}/jira/issue-types", f"/projects/{project['id']}/context"):
            assert client.get(path).status_code == 200, path
        assert client.patch(f"/projects/{project['id']}", json={"repo_path": str(tmp_path)}).json()["repo_path"] == str(tmp_path)
        # Schéma page: prompts and tools come from the code.
        agents = client.get("/agents").json()
        assert [agent["stage"] for agent in agents["agents"]] == ["authoring", "refinement", "specification"]
        spec = agents["agents"][2]
        assert "search_code" in [tool["name"] for tool in spec["tools"]] and spec["system_prompt"].startswith("You are the specification agent")
    get_settings.cache_clear()
