"""Minimal JSON document store on SQLite: one table, one row per document.

Good enough for a first version; swap for PostgreSQL + SQLAlchemy when the schema settles.
"""

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def init(path: Path) -> None:
    global _conn
    path.parent.mkdir(parents=True, exist_ok=True)
    _conn = sqlite3.connect(path, check_same_thread=False)
    _conn.execute("create table if not exists docs (collection text, id text, data text, primary key (collection, id))")
    _conn.commit()


def _db() -> sqlite3.Connection:
    if _conn is None:
        raise RuntimeError("db.init() was not called")
    return _conn


def get(collection: str, id: str) -> dict[str, Any] | None:
    with _lock:
        row = _db().execute("select data from docs where collection = ? and id = ?", (collection, id)).fetchone()
    return json.loads(row[0]) if row else None


def put(collection: str, id: str, data: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        _db().execute("insert or replace into docs values (?, ?, ?)", (collection, id, json.dumps(data, default=str)))
        _db().commit()
    return data


def delete(collection: str, id: str) -> None:
    with _lock:
        _db().execute("delete from docs where collection = ? and id = ?", (collection, id))
        _db().commit()


def all(collection: str) -> list[dict[str, Any]]:
    with _lock:
        rows = _db().execute("select data from docs where collection = ? order by rowid", (collection,)).fetchall()
    return [json.loads(row[0]) for row in rows]
