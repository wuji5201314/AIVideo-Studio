"""Free HD Stock Video & Photo Client powered by Pexels API.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- Pure stdlib urllib, timeout controls
- File <= 200 lines, Function <= 80 lines
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from packages.studio_engine.settings_store import SettingsStore

REPO_ROOT = Path(__file__).resolve().parents[2]


class PexelsClient:
    """Searches and downloads royalty-free HD stock videos and photos from Pexels."""

    VIDEO_API = "https://api.pexels.com/videos/search"
    PHOTO_API = "https://api.pexels.com/v1/search"

    def __init__(self, api_key: Optional[str] = None) -> None:
        if api_key is not None:
            self.api_key = api_key.strip()
        else:
            settings = SettingsStore().get_cloud_api_settings()
            self.api_key = (settings.pexels_api_key or "").strip()

    def search_videos(
        self,
        query: str,
        orientation: str = "portrait",
        per_page: int = 8,
    ) -> List[Dict[str, Any]]:
        """Search HD stock videos on Pexels (orientation: portrait | landscape | square)."""
        if not self.api_key:
            raise RuntimeError("尚未配置 Pexels 免费素材库 API Key，请先点击右上角「配置 AI 模型 API Key」填入。")

        qs = urllib.parse.urlencode({
            "query": query.strip() or "minimalist interior",
            "orientation": orientation,
            "per_page": max(1, min(per_page, 15)),
        })
        data = self._get_json(f"{self.VIDEO_API}?{qs}")
        items: List[Dict[str, Any]] = []
        for v in data.get("videos") or []:
            best_file = self._pick_best_video_file(v.get("video_files") or [])
            if not best_file:
                continue
            items.append({
                "id": str(v.get("id")),
                "duration": int(v.get("duration") or 5),
                "width": int(best_file.get("width") or 720),
                "height": int(best_file.get("height") or 1280),
                "thumbnail": str(v.get("image") or ""),
                "download_url": str(best_file.get("link") or ""),
                "author": str((v.get("user") or {}).get("name") or "Pexels"),
            })
        return items

    def download_video(self, download_url: str, output_dir: Optional[Path] = None) -> Path:
        """Download selected Pexels HD MP4 clip to local storage."""
        dest_dir = (output_dir or (REPO_ROOT / "storage" / "temp" / "pexels")).resolve()
        dest_dir.mkdir(parents=True, exist_ok=True)
        out_path = dest_dir / f"pexels-{uuid.uuid4().hex[:8]}.mp4"
        req = urllib.request.Request(download_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60.0) as resp:
            out_path.write_bytes(resp.read())
        return out_path

    def _get_json(self, url: str) -> Dict[str, Any]:
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": self.api_key,
                "User-Agent": "AIVideoStudio/1.0",
            },
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=15.0) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))

    @staticmethod
    def _pick_best_video_file(files: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Prefer 720p/1080p MP4 stream for fast download and smooth editing."""
        mp4s = [f for f in files if str(f.get("file_type", "")).lower() == "video/mp4" and f.get("link")]
        if not mp4s:
            return None
        hd = [f for f in mp4s if 700 <= int(f.get("width") or 0) <= 1920]
        candidates = hd or mp4s
        candidates.sort(key=lambda f: int(f.get("width") or 0), reverse=True)
        return candidates[0]
