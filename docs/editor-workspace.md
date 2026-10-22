# Story editor

The React application exposes `/editor?us=<story-id>` from the sidebar and the issue page. The layout follows Synara's editor: a vertical activity bar switches the sidebar between Files, Changes and Search (re-selecting the active item collapses it), and the open file shows a breadcrumb header with its save state. The explorer groups documents and multiple repositories below the selected story. `@pierre/trees/react` supplies the file explorer, keyboard navigation and modified-file markers; the Search pane filters files by path. `@pierre/diffs/react` and `@pierre/diffs/edit` supply syntax-highlighted editing, line numbers, undo/redo and search (Cmd/Ctrl+F). `MultiFileDiff` renders the Changes view. Themes follow the application appearance. Edit state is scoped to the story, workspace instance and file, preserving undo history when switching files; discarding changes starts a new edit session. Pierre owns the live document while the application persists drafts from `onEditChange`.

The current workspace is a frontend demo, provided by `demoWorkspace()` in `src/lib/editor-workspace.ts`. The frontend/backend repositories are illustrative, not repositories discovered on disk or assigned by the API. The documents are copies of the story's stage outputs; editing these copies does not update the original stage documents.

Drafts and explicitly saved snapshots live in browser localStorage, separately for each story (`atlas-editor:v1:<story-id>`). Closing a file and switching stories preserve drafts. Save / Cmd/Ctrl+S marks the current edits as saved. Changes lists modified files with line counts and compares the current text with the original demo file; saving does not clear this diff. Discard restores the original file after confirmation. Storage failures appear in the file header.

Review & merge shows the locally changed files and links to the story's existing merge request when available. It does not commit, push, open or merge a request; local demo edits are never sent to GitLab.

## Connecting real workspaces

Each US should own a server workspace directory containing its assigned repositories, for example:

```text
workspaces/US-109/
  documents/
  frontend/  # repository checkout / worktree
  backend/   # repository checkout / worktree
```

The browser needs an authenticated backend API to access that server directory. Suggested endpoints (not implemented):

| Endpoint | Purpose |
| --- | --- |
| `GET /us/{id}/workspace` | Repository IDs, names, branches, merge requests, workspace status |
| `GET /us/{id}/workspace/tree?repository_id=…&path=…` | Load directory entries on expansion |
| `GET /us/{id}/workspace/file?repository_id=…&path=…` | File contents, language and revision |
| `PUT /us/{id}/workspace/file` | Save contents with repository ID, path and expected revision |
| `GET /us/{id}/workspace/changes` | Git status and diffs grouped by repository |
| `POST /us/{id}/workspace/repositories/{repo_id}/merge-request` | Commit and push changes, create or update this repository's MR |
| `POST /us/{id}/workspace/repositories/{repo_id}/merge` | Merge this repository's MR after server checks |

Replace the demo adapter and local persistence with API hooks when those endpoints exist. Keep file contents opaque in the HTTP key conversion layer. The server must scope paths to the authorized story/repository, enforce revisions to prevent overwriting agent edits, and report pipeline/conflict status per repository. A multi-repository story has independent merge requests; the interface must display partial completion if one merge fails.
