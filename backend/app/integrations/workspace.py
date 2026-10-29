"""Read-only access to a local repository clone, scoped to its root."""

import re
import shutil
import subprocess
from pathlib import Path

IGNORED = {".git", "node_modules", ".venv", "venv", "dist", "build", "__pycache__", ".next", "target", "vendor", ".idea", "coverage"}
KEY_FILES = ["README.md", "AGENTS.md", "CLAUDE.md", "package.json", "pyproject.toml", "requirements.txt", "go.mod", "pom.xml", "build.gradle", "Cargo.toml", "docker-compose.yml"]
MAX_FILE_BYTES = 400_000


class Workspace:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()

    def _resolve(self, path: str) -> Path:
        target = (self.root / path.lstrip("/")).resolve()
        if target != self.root and self.root not in target.parents:
            raise ValueError(f"Path outside the repository: {path}")
        return target

    def list_dir(self, path: str = ".") -> str:
        target = self._resolve(path)
        if not target.is_dir():
            return f"Not a directory: {path}"
        entries = sorted(target.iterdir(), key=lambda item: (item.is_file(), item.name))
        lines = [f"{entry.name}/" if entry.is_dir() else entry.name for entry in entries if entry.name not in IGNORED]
        return "\n".join(lines[:300]) or "(empty)"

    def tree(self, depth: int = 2, limit: int = 200) -> str:
        lines: list[str] = []

        def walk(directory: Path, level: int) -> None:
            for entry in sorted(directory.iterdir(), key=lambda item: (item.is_file(), item.name)):
                if entry.name in IGNORED or entry.name.startswith(".") or len(lines) >= limit:
                    continue
                lines.append("  " * level + (f"{entry.name}/" if entry.is_dir() else entry.name))
                if entry.is_dir() and level + 1 < depth:
                    walk(entry, level + 1)

        walk(self.root, 0)
        return "\n".join(lines)

    def read_file(self, path: str, start: int = 1, end: int | None = None) -> str:
        target = self._resolve(path)
        if not target.is_file():
            return f"File not found: {path}"
        if target.stat().st_size > MAX_FILE_BYTES:
            return f"File too large to read whole: {path}. Use search_code to find the relevant lines first."
        lines = target.read_text(errors="replace").splitlines()
        end = min(end or start + 299, len(lines))
        numbered = [f"{number:>5} {lines[number - 1]}" for number in range(max(start, 1), end + 1)]
        suffix = f"\n… {len(lines) - end} more lines (read again with start={end + 1})" if end < len(lines) else ""
        return f"{path} (lines {start}-{end} of {len(lines)})\n" + "\n".join(numbered) + suffix

    def search_code(self, pattern: str, glob: str | None = None, limit: int = 60) -> str:
        if rg := shutil.which("rg"):
            command = [rg, "--line-number", "--no-heading", "--max-columns", "200", "--max-count", "5", "-i", pattern, "."]
            if glob:
                command[1:1] = ["--glob", glob]
            result = subprocess.run(command, cwd=self.root, capture_output=True, text=True, timeout=30)
            lines = result.stdout.splitlines()
        else:
            lines = self._python_search(pattern, glob, limit)
        if not lines:
            return f"No match for {pattern!r}"
        more = f"\n… {len(lines) - limit} more matches, narrow the pattern or glob" if len(lines) > limit else ""
        return "\n".join(line.removeprefix("./") for line in lines[:limit]) + more

    def _python_search(self, pattern: str, glob: str | None, limit: int) -> list[str]:
        regex = re.compile(pattern, re.IGNORECASE)
        matches: list[str] = []
        for path in self.root.rglob(glob or "*"):
            if any(part in IGNORED for part in path.relative_to(self.root).parts) or not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
                continue
            try:
                for number, line in enumerate(path.read_text(errors="ignore").splitlines(), 1):
                    if regex.search(line):
                        matches.append(f"{path.relative_to(self.root)}:{number}:{line.strip()[:200]}")
            except OSError:
                continue
            if len(matches) > limit:
                break
        return matches

    def git_log(self, path: str = ".", limit: int = 15) -> str:
        self._resolve(path)
        result = subprocess.run(
            ["git", "log", f"-{limit}", "--format=%h %ad %an: %s", "--date=short", "--", path],
            cwd=self.root, capture_output=True, text=True, timeout=30,
        )
        return result.stdout.strip() or "No history (shallow clone or new file)."

    def key_files(self, limit: int = 4000) -> str:
        sections = []
        for name in KEY_FILES:
            path = self.root / name
            if path.is_file():
                text = path.read_text(errors="replace")
                sections.append(f"### {name}\n{text[:limit]}")
        return "\n\n".join(sections)
