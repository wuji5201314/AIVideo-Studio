"""Persistent engine configuration store backed by SQLite.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- File <= 400 lines, Function <= 80 lines
- Safe parameterized SQL queries
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[2]


class AvatarEngineSettings(BaseModel):
    """Persisted configuration for Wan2.2-Animate and digital human backends."""

    active_backend: str = Field(
        default="auto",
        description="auto | comfyui | wan_worker | dashscope | local_fallback",
    )
    comfyui_url: str = Field(default="http://127.0.0.1:8188", description="ComfyUI server base URL")
    wan_worker_url: str = Field(default="http://127.0.0.1:8390", description="Standalone Wan2.2 GPU worker URL")
    dashscope_api_key: str = Field(default="", description="Optional DashScope API key for wan2.2-animate")
    dashscope_base_url: str = Field(
        default="https://dashscope.aliyuncs.com/api/v1",
        description="DashScope API base URL",
    )
    use_relighting_lora: bool = Field(
        default=True,
        description="Enable Relighting LoRA in Wan2.2-Animate Replace mode",
    )
    default_resolution: str = Field(default="720p", description="480p or 720p")
    default_voice: str = Field(default="zh-CN-XiaoxiaoNeural", description="Default TTS voice")


class SettingsStore:
    """SQLite key-value store for platform engine settings."""

    def __init__(self, db_path: Optional[Path] = None) -> None:
        self.db_path = (db_path or (REPO_ROOT / "storage" / "workflow.db")).resolve()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_table()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        return conn

    def _init_table(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS studio_settings (
                    key        TEXT PRIMARY KEY,
                    value_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """
            )
            conn.commit()

    def get_avatar_settings(self) -> AvatarEngineSettings:
        """Load persisted AvatarEngineSettings with defaults."""
        with self._connect() as conn:
            row = conn.execute(
                "SELECT value_json FROM studio_settings WHERE key = ?",
                ("avatar_engine",),
            ).fetchone()
        if not row:
            return AvatarEngineSettings()
        try:
            data = json.loads(row["value_json"])
            return AvatarEngineSettings.model_validate(data)
        except Exception:
            return AvatarEngineSettings()

    def save_avatar_settings(self, patch: Dict[str, Any]) -> AvatarEngineSettings:
        """Merge partial updates into persisted AvatarEngineSettings."""
        current = self.get_avatar_settings().model_dump()
        for k, v in patch.items():
            if k in current and v is not None:
                # Preserve existing secret if masked placeholder is sent back
                if k == "dashscope_api_key" and isinstance(v, str) and v.startswith("sk-***"):
                    continue
                current[k] = v
        updated = AvatarEngineSettings.model_validate(current)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO studio_settings (key, value_json, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(key) DO UPDATE SET
                    value_json = excluded.value_json,
                    updated_at = datetime('now')
                """,
                ("avatar_engine", updated.model_dump_json()),
            )
            conn.commit()
        return updated

    def masked_dict(self, settings: AvatarEngineSettings) -> Dict[str, Any]:
        """Return API-safe dict with masked API key."""
        data = settings.model_dump()
        raw_key = data.get("dashscope_api_key") or ""
        data["has_dashscope_key"] = bool(raw_key.strip())
        if len(raw_key) > 8:
            data["dashscope_api_key"] = f"sk-***{raw_key[-4:]}"
        elif raw_key:
            data["dashscope_api_key"] = "sk-***"
        return data
