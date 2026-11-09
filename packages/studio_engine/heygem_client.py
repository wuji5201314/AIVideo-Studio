"""HeyGem / Duix-Avatar local HTTP service client (port 8383).

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- Subprocess with list args
- Guard clauses and timeouts
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class HeyGemClient:
    """Client for local HeyGem / Duix neural lip-sync engine."""

    def __init__(self, base_url: str = "http://127.0.0.1:8383") -> None:
        self.base_url = base_url.rstrip("/")

    def is_available(self, timeout: float = 1.5) -> bool:
        """Check if HeyGem service is active and responding on local port."""
        probe_url = f"{self.base_url}/easy/query?code=health_probe"
        try:
            req = urllib.request.Request(probe_url, method="GET")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                resp.read()
            return True
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
            return False

    def submit_lipsync_task(
        self,
        audio_path: Path,
        video_path: Path,
        work_dir: Path,
    ) -> Optional[str]:
        """Submit lip-sync synthesis task to HeyGem API."""
        if not self.is_available():
            return None

        code = uuid.uuid4().hex
        task_dir = work_dir / "tasks" / code
        task_dir.mkdir(parents=True, exist_ok=True)

        staged_audio = task_dir / "audio.wav"
        staged_video = task_dir / "video.mp4"
        shutil.copy2(audio_path, staged_audio)
        shutil.copy2(video_path, staged_video)

        payload = {
            "audio_url": str(staged_audio.as_posix()),
            "video_url": str(staged_video.as_posix()),
            "code": code,
            "chaofen": 0,
            "watermark_switch": 0,
            "pn": 1,
        }

        try:
            req = urllib.request.Request(
                f"{self.base_url}/easy/submit",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30.0) as resp:
                body = resp.read().decode("utf-8")
                res = json.loads(body)
                if res.get("success") is not False:
                    return code
        except Exception as exc:
            logger.warning("Failed to submit task to HeyGem: %s", exc)
        return None

    def poll_lipsync_task(
        self,
        task_code: str,
        timeout_sec: float = 180.0,
        poll_interval: float = 3.0,
    ) -> Optional[str]:
        """Poll task until complete and return output video path."""
        start_t = time.time()
        while time.time() - start_t < timeout_sec:
            try:
                url = f"{self.base_url}/easy/query?code={task_code}"
                req = urllib.request.Request(url, method="GET")
                with urllib.request.urlopen(req, timeout=10.0) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    inner = data.get("data") or {}
                    status = inner.get("status", data.get("status"))
                    result = inner.get("result") or inner.get("video_path") or data.get("result")

                    if status in (2, "2", "success", "done", "finish") or (
                        isinstance(result, str) and result.endswith(".mp4")
                    ):
                        return result
                    if status in (3, "3", "fail", "failed", "error"):
                        logger.error("HeyGem task failed: %s", inner.get("msg") or data)
                        return None
            except Exception as exc:
                logger.warning("HeyGem polling error: %s", exc)

            time.sleep(poll_interval)
        return None
