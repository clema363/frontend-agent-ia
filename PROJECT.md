# Project overview

## In one sentence

An application that guides a user story from creation to an implementation plan: AI agents help product owners (POs) and business analysts (BAs) write it, refine it, compare it against existing code, and produce a plan ready to send to a coding agent.

## Who it is for

- **POs / BAs**: writing and improving user stories.
- **Developers / tech leads**: checking technical feasibility and planning implementation.

## User story workflow

The application has four successive stages.

### 1. Creation (“New US”, then “To author”)

The PO or BA creates a story as in Jira: type (story, epic, bug, task, spike), project, priority, parent epic and optional title. The main input is the **raw requirement**, with optional context links (Jira, Confluence). The authoring agent rewrites this raw text into an initial clean draft.

### 2. Refinement

The agent improves the draft with acceptance criteria in Given / When / Then format, business rules and other details.

### 3. Specification

The agent produces a Markdown document using Jira, Confluence and GitLab. It compares the user story against the existing code:

- whether it follows the specification and existing behavior;
- whether it can be implemented in the current codebase;
- which libraries can be used;
- which code-level concerns need attention.

### 4. Code review and implementation plan

The agent produces an implementation plan that can be sent directly to a coding agent to implement the story.

```text
Creation → Refinement → Specification → Code review / plan → Coding agent
```

### Approval at each stage

Each stage produces a Markdown document. Depending on their role, a person can:

- approve the document (moving the story to the next stage) or reject it;
- edit the text manually;
- ask the agent for a change through chat.

Approval roles: PO or BA for creation and refinement, Architect or DEV for specification, DEV for the plan.

## Integrations

The application connects to:

- **Jira**: user stories and tickets.
- **GitLab**: source code analyzed during specification and code review.
- **Confluence**: documentation and business context.

## Interface

The interface draws inspiration from ticket management tools such as Jira and Linear: a Kanban board where each column represents a workflow stage and its agent. Cards stay minimal; clicking opens a resizable side panel with one tab per stage, approval controls and chat.

## Current status

Only the frontend exists for now (see [README.md](README.md)). Jira, GitLab and Confluence connections, along with the agents, still need to be implemented.
