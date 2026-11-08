"""SQLite metadata store and CAS file management for AIVideo-Studio.

Follows Alibaba Coding Guidelines:
- Strict transaction management
- Append-only revision records
- Atomic file writes to prevent corrupted cache assets
- Line limits: File <= 400 lines, Function <= 80 lines
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


def get_iso_now() -> str:
    """Return current UTC time in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


class WorkflowStore:
    """Encapsulates SQLite storage and Content-Addressed Storage (CAS)."""

    def __init__(self, base_dir: Path | str = "storage") -> None:
        self.base_dir = Path(base_dir).resolve()
        self.db_path = self.base_dir / "workflow.db"
        self.assets_dir = self.base_dir / "assets"
        self.temp_dir = self.base_dir / "temp"

        self.assets_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Create a sqlite connection with WAL mode and foreign keys enabled."""
        conn = sqlite3.connect(str(self.db_path), timeout=15.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self) -> None:
        """Initialize the 5 core tables defined in architecture specification."""
        ddl = """
        CREATE TABLE IF NOT EXISTS wf_projects (
            id               TEXT PRIMARY KEY,
            title            TEXT NOT NULL,
            brief            TEXT NOT NULL,
            global_config    TEXT NOT NULL DEFAULT '{}',
            status           TEXT NOT NULL,
            active_graph_rev INTEGER NOT NULL DEFAULT 1,
            created_at       TEXT NOT NULL,
            updated_at       TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS wf_nodes (
            project_id      TEXT NOT NULL,
            node_key        TEXT NOT NULL,
            node_type       TEXT NOT NULL,
            shot_id         TEXT,
            order_no        INTEGER NOT NULL,
            gate_enabled    INTEGER NOT NULL DEFAULT 1,
            status          TEXT NOT NULL,
            config_json     TEXT NOT NULL DEFAULT '{}',
            locked          INTEGER NOT NULL DEFAULT 0,
            current_rev_id  TEXT,
            updated_at      TEXT NOT NULL,
            PRIMARY KEY (project_id, node_key)
        );

        CREATE TABLE IF NOT EXISTS wf_node_revisions (
            rev_id          TEXT PRIMARY KEY,
            project_id      TEXT NOT NULL,
            node_key        TEXT NOT NULL,
            parent_rev_id   TEXT,
            rev_number      INTEGER NOT NULL,
            trigger_mode    TEXT NOT NULL,
            fingerprint     TEXT NOT NULL,
            input_snapshot  TEXT NOT NULL DEFAULT '{}',
            config_snapshot TEXT NOT NULL DEFAULT '{}',
            output_json     TEXT NOT NULL DEFAULT '{}',
            feedback_id     TEXT,
            duration_ms     INTEGER DEFAULT 0,
            created_at      TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS wf_feedbacks (
            feedback_id     TEXT PRIMARY KEY,
            project_id      TEXT NOT NULL,
            node_key        TEXT NOT NULL,
            base_rev_id     TEXT NOT NULL,
            mode            TEXT NOT NULL,
            instruction     TEXT NOT NULL DEFAULT '',
            locked_keys     TEXT NOT NULL DEFAULT '[]',
            patches_json    TEXT NOT NULL DEFAULT '{}',
            param_overrides TEXT NOT NULL DEFAULT '{}',
            created_at      TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS wf_blobs (
            sha256          TEXT PRIMARY KEY,
            kind            TEXT NOT NULL,
            rel_path        TEXT NOT NULL,
            size_bytes      INTEGER NOT NULL,
            meta_json       TEXT NOT NULL DEFAULT '{}',
            created_at      TEXT NOT NULL
        );
        """
        with self._get_connection() as conn:
            conn.executescript(ddl)

    def atomic_write(self, dest_path: Path, data: bytes) -> None:
        """Write bytes to a temp file, fsync, and atomic rename."""
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_file_path = tempfile.mkstemp(
            prefix=".tmp-",
            dir=str(self.temp_dir)
        )
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_file_path, dest_path)
        except Exception:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            raise

    def put_blob(self, kind: str, data: bytes, meta: Optional[Dict[str, Any]] = None) -> str:
        """Save bytes into CAS assets pool indexed by SHA256."""
        sha256_hash = hashlib.sha256(data).hexdigest()
        ext = meta.get("extension", "bin") if meta else "bin"
        file_name = f"{sha256_hash}.{ext}"
        rel_path = f"assets/{file_name}"
        dest_path = self.assets_dir / file_name

        if not dest_path.exists():
            self.atomic_write(dest_path, data)

        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO wf_blobs
                (sha256, kind, rel_path, size_bytes, meta_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    sha256_hash,
                    kind,
                    rel_path,
                    len(data),
                    json.dumps(meta or {}, ensure_ascii=False),
                    get_iso_now(),
                ),
            )
        return sha256_hash

    def get_blob_path(self, sha256_hash: str) -> Optional[Path]:
        """Resolve absolute file path for a content hash."""
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT rel_path FROM wf_blobs WHERE sha256 = ?",
                (sha256_hash,),
            ).fetchone()
            if not row:
                return None
            path = (self.base_dir / row["rel_path"]).resolve()
            return path if path.exists() else None

    def create_project(
        self,
        project_id: str,
        title: str,
        brief: str,
        global_config: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Insert a new project record."""
        now = get_iso_now()
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO wf_projects
                (id, title, brief, global_config, status, active_graph_rev, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'IDLE', 1, ?, ?)
                """,
                (
                    project_id,
                    title,
                    brief,
                    json.dumps(global_config or {}, ensure_ascii=False),
                    now,
                    now,
                ),
            )

    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Fetch project record by id."""
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM wf_projects WHERE id = ?",
                (project_id,),
            ).fetchone()
            return dict(row) if row else None

    def list_projects(self, limit: int = 50) -> List[Dict[str, Any]]:
        """List recent projects ordered by updated_at descending."""
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM wf_projects ORDER BY updated_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def update_project_status(self, project_id: str, status: str) -> None:
        """Update overall project status."""
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE wf_projects SET status = ?, updated_at = ? WHERE id = ?",
                (status, get_iso_now(), project_id),
            )

    def upsert_node(
        self,
        project_id: str,
        node_key: str,
        node_type: str,
        order_no: int,
        status: str,
        shot_id: Optional[str] = None,
        gate_enabled: bool = True,
        config: Optional[Dict[str, Any]] = None,
        locked: bool = False,
        current_rev_id: Optional[str] = None,
    ) -> None:
        """Insert or update a node instance in a project."""
        now = get_iso_now()
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO wf_nodes
                (project_id, node_key, node_type, shot_id, order_no,
                 gate_enabled, status, config_json, locked, current_rev_id, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, node_key) DO UPDATE SET
                    status = excluded.status,
                    gate_enabled = excluded.gate_enabled,
                    config_json = excluded.config_json,
                    locked = excluded.locked,
                    current_rev_id = COALESCE(excluded.current_rev_id, wf_nodes.current_rev_id),
                    updated_at = excluded.updated_at
                """,
                (
                    project_id,
                    node_key,
                    node_type,
                    shot_id,
                    order_no,
                    1 if gate_enabled else 0,
                    status,
                    json.dumps(config or {}, ensure_ascii=False),
                    1 if locked else 0,
                    current_rev_id,
                    now,
                ),
            )

    def get_nodes(self, project_id: str) -> List[Dict[str, Any]]:
        """List all nodes for a project ordered by order_no."""
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM wf_nodes WHERE project_id = ? ORDER BY order_no ASC",
                (project_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_node(self, project_id: str, node_key: str) -> Optional[Dict[str, Any]]:
        """Fetch a specific node by key."""
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM wf_nodes WHERE project_id = ? AND node_key = ?",
                (project_id, node_key),
            ).fetchone()
            return dict(row) if row else None

    def add_revision(
        self,
        rev_id: str,
        project_id: str,
        node_key: str,
        trigger_mode: str,
        fingerprint: str,
        output_data: Dict[str, Any],
        parent_rev_id: Optional[str] = None,
        input_snapshot: Optional[Dict[str, Any]] = None,
        config_snapshot: Optional[Dict[str, Any]] = None,
        feedback_id: Optional[str] = None,
        duration_ms: int = 0,
    ) -> int:
        """Append a new revision record and update current_rev_id on the node."""
        with self._get_connection() as conn:
            row = conn.execute(
                """
                SELECT COALESCE(MAX(rev_number), 0) + 1 AS next_rev
                FROM wf_node_revisions
                WHERE project_id = ? AND node_key = ?
                """,
                (project_id, node_key),
            ).fetchone()
            rev_number = row["next_rev"] if row else 1

            conn.execute(
                """
                INSERT INTO wf_node_revisions
                (rev_id, project_id, node_key, parent_rev_id, rev_number,
                 trigger_mode, fingerprint, input_snapshot, config_snapshot,
                 output_json, feedback_id, duration_ms, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rev_id,
                    project_id,
                    node_key,
                    parent_rev_id,
                    rev_number,
                    trigger_mode,
                    fingerprint,
                    json.dumps(input_snapshot or {}, ensure_ascii=False),
                    json.dumps(config_snapshot or {}, ensure_ascii=False),
                    json.dumps(output_data, ensure_ascii=False),
                    feedback_id,
                    duration_ms,
                    get_iso_now(),
                ),
            )

            conn.execute(
                """
                UPDATE wf_nodes
                SET current_rev_id = ?, updated_at = ?
                WHERE project_id = ? AND node_key = ?
                """,
                (rev_id, get_iso_now(), project_id, node_key),
            )
            return rev_number

    def get_revision(self, rev_id: str) -> Optional[Dict[str, Any]]:
        """Fetch revision by rev_id."""
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM wf_node_revisions WHERE rev_id = ?",
                (rev_id,),
            ).fetchone()
            return dict(row) if row else None

    def list_revisions(self, project_id: str, node_key: str) -> List[Dict[str, Any]]:
        """List all revisions for a node ordered by rev_number descending."""
        with self._get_connection() as conn:
            rows = conn.execute(
                """
                SELECT * FROM wf_node_revisions
                WHERE project_id = ? AND node_key = ?
                ORDER BY rev_number DESC
                """,
                (project_id, node_key),
            ).fetchall()
            return [dict(r) for r in rows]

    def add_feedback(
        self,
        feedback_id: str,
        project_id: str,
        node_key: str,
        base_rev_id: str,
        mode: str,
        instruction: str = "",
        locked_keys: Optional[List[str]] = None,
        patches: Optional[Dict[str, Any]] = None,
        param_overrides: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Insert user feedback audit record."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO wf_feedbacks
                (feedback_id, project_id, node_key, base_rev_id, mode,
                 instruction, locked_keys, patches_json, param_overrides, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    feedback_id,
                    project_id,
                    node_key,
                    base_rev_id,
                    mode,
                    instruction,
                    json.dumps(locked_keys or [], ensure_ascii=False),
                    json.dumps(patches or {}, ensure_ascii=False),
                    json.dumps(param_overrides or {}, ensure_ascii=False),
                    get_iso_now(),
                ),
            )
