"""Alibaba DashScope hosted Wan2.2-Animate API adapter (wan2.2-animate-mix / move).

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- File <= 250 lines, Function <= 80 lines
"""

from __future__ import annotations

import base64
import json
import mimetypes
import time
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from packages.studio_engine.wan_animate.base import (
    BackendHealth,
    BaseWanAnimateBackend,
    ProgressCallback,
    WanAnimateRequest,
    WanAnimateResult,
)


class DashScopeWanAnimateBackend(BaseWanAnimateBackend):
    """Calls DashScope wan2.2-animate-mix (replace) / wan2.2-animate-move API."""

    backend_id = "dashscope"
    label = "DashScope · Wan2.2-Animate 托管 API"

    def __init__(
        self,
        api_key: str = "",
        base_url: str = "https://dashscope.aliyuncs.com/api/v1",
    ) -> None:
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")

    def check_health(self, timeout: float = 2.0) -> BackendHealth:
        """Check whether API key is configured."""
        if not self.api_key:
            return BackendHealth(
                backend_id=self.backend_id,
                label=self.label,
                available=False,
                endpoint=self.base_url,
                detail="未配置 DashScope API Key",
            )
        return BackendHealth(
            backend_id=self.backend_id,
            label=self.label,
            available=True,
            endpoint=self.base_url,
            detail="API Key 已配置（支持 wan2.2-animate-mix / move）",
        )

    def generate(
        self,
        req: WanAnimateRequest,
        on_progress: Optional[ProgressCallback] = None,
    ) -> WanAnimateResult:
        """Submit async Wan2.2-Animate task to DashScope and download result MP4."""
        if not self.api_key:
            raise RuntimeError("请先在引擎配置中心填写 DashScope API Key")

        model_name = "wan2.2-animate-mix" if req.mode == "replace" else "wan2.2-animate-move"
        self._emit(on_progress, 0.18, "preprocess", f"正在准备 {model_name} 请求素材...")

        image_b64 = self._encode_data_uri(Path(req.character_image_path))
        video_url_or_b64 = (
            req.video_path
            if req.video_path.startswith(("http://", "https://"))
            else self._encode_data_uri(Path(req.video_path))
        )

        payload: Dict[str, Any] = {
            "model": model_name,
            "input": {
                "image_url": image_b64,
                "video_url": video_url_or_b64,
            },
            "parameters": {
                "mode": "wan-std" if req.resolution == "480p" else "wan-pro",
            },
        }

        self._emit(on_progress, 0.30, "wan_animate", f"正在提交至 {model_name} 异步任务...")
        task_id = self._submit_task(payload)
        video_url = self._poll_task(task_id, on_progress=on_progress)

        self._emit(on_progress, 0.86, "wan_animate", "正在下载 Wan2.2-Animate 生成成片...")
        out_dir = Path(req.output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"wan22-ds-{req.mode}-{uuid.uuid4().hex[:8]}.mp4"
        urllib.request.urlretrieve(video_url, str(out_path))

        return WanAnimateResult(
            video_path=str(out_path),
            backend_id=self.backend_id,
            backend_label=self.label,
            mode=req.mode,
            is_neural_wan=True,
            note=f"DashScope {model_name} 推理完成",
        )

    def _submit_task(self, payload: Dict[str, Any]) -> str:
        """POST async video-synthesis job to DashScope."""
        url = f"{self.base_url}/services/aigc/image2video/video-synthesis"
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "X-DashScope-Async": "enable",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=60.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        task_id = (data.get("output") or {}).get("task_id")
        if not task_id:
            raise RuntimeError(f"DashScope 提交失败: {data}")
        return str(task_id)

    def _poll_task(
        self,
        task_id: str,
        timeout_sec: float = 600.0,
        on_progress: Optional[ProgressCallback] = None,
    ) -> str:
        """Poll DashScope task endpoint until SUCCEEDED."""
        url = f"{self.base_url}/tasks/{task_id}"
        start_t = time.time()
        while time.time() - start_t < timeout_sec:
            request = urllib.request.Request(
                url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                method="GET",
            )
            with urllib.request.urlopen(request, timeout=20.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            out = data.get("output") or {}
            status = str(out.get("task_status", "")).upper()
            if status == "SUCCEEDED":
                video_url = out.get("video_url") or (out.get("results") or {}).get("video_url")
                if not video_url:
                    raise RuntimeError(f"DashScope 成功但未返回 video_url: {data}")
                return str(video_url)
            if status in ("FAILED", "CANCELED"):
                raise RuntimeError(f"DashScope 任务失败: {out.get('message') or data}")
            elapsed = time.time() - start_t
            self._emit(on_progress, min(0.82, 0.35 + elapsed / 180.0 * 0.45), "wan_animate", f"DashScope 推理中 ({int(elapsed)}s)...")
            time.sleep(4.0)
        raise TimeoutError(f"DashScope 推理超时 ({timeout_sec}s)")

    @staticmethod
    def _encode_data_uri(path: Path) -> str:
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"data:{mime};base64,{b64}"

    @staticmethod
    def _emit(cb: Optional[ProgressCallback], progress: float, stage: str, msg: str) -> None:
        if cb:
            cb(progress, stage, msg)
