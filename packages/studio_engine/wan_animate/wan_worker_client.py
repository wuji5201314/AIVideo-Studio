"""HTTP client for standalone open-source Wan2.2-Animate GPU Worker.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- File <= 250 lines, Function <= 80 lines
"""

from __future__ import annotations

import json
import mimetypes
import time
import urllib.request
import uuid
from pathlib import Path
from typing import Optional

from packages.studio_engine.wan_animate.base import (
    BackendHealth,
    BaseWanAnimateBackend,
    ProgressCallback,
    WanAnimateRequest,
    WanAnimateResult,
)


class WanWorkerBackend(BaseWanAnimateBackend):
    """Connects to workers/wan_animate_worker.py running official Wan-Video/Wan2.2."""

    backend_id = "wan_worker"
    label = "Wan2.2 官方开源 GPU Worker"

    def __init__(self, base_url: str = "http://127.0.0.1:8390") -> None:
        self.base_url = base_url.rstrip("/")

    def check_health(self, timeout: float = 2.0) -> BackendHealth:
        """Probe GET /health on the GPU worker."""
        try:
            with urllib.request.urlopen(f"{self.base_url}/health", timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
            gpu = data.get("gpu") or "GPU Worker"
            return BackendHealth(
                backend_id=self.backend_id,
                label=self.label,
                available=True,
                endpoint=self.base_url,
                detail=f"已连接 ({gpu})",
            )
        except Exception as exc:
            return BackendHealth(
                backend_id=self.backend_id,
                label=self.label,
                available=False,
                endpoint=self.base_url,
                detail=f"未连接: {type(exc).__name__}",
            )

    def generate(
        self,
        req: WanAnimateRequest,
        on_progress: Optional[ProgressCallback] = None,
    ) -> WanAnimateResult:
        """Submit multipart job to Wan2.2 GPU worker, poll status, download MP4."""
        self._emit(on_progress, 0.15, "preprocess", "正在上传素材至开源 Wan2.2 GPU Worker...")
        task_id = self._submit_job(req)

        self._emit(on_progress, 0.30, "wan_animate", "Worker 正在运行 preprocess_data.py 与 generate.py...")
        self._poll_job(task_id, on_progress=on_progress)

        self._emit(on_progress, 0.85, "wan_animate", "正在下载 Wan2.2-Animate-14B 生成视频...")
        out_dir = Path(req.output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"wan22-worker-{req.mode}-{uuid.uuid4().hex[:8]}.mp4"
        with urllib.request.urlopen(f"{self.base_url}/tasks/{task_id}/result", timeout=120.0) as resp:
            out_path.write_bytes(resp.read())

        return WanAnimateResult(
            video_path=str(out_path),
            backend_id=self.backend_id,
            backend_label=self.label,
            mode=req.mode,
            is_neural_wan=True,
            note=f"官方 Wan2.2-Animate-14B ({req.mode}) 推理完成",
        )

    def _submit_job(self, req: WanAnimateRequest) -> str:
        """Build multipart form-data request for POST /tasks."""
        boundary = f"----WanWorker{uuid.uuid4().hex}"
        body = bytearray()
        fields = {
            "mode": req.mode,
            "resolution": req.resolution,
            "use_relighting_lora": "true" if req.use_relighting_lora else "false",
            "prompt": req.prompt,
        }
        for name, val in fields.items():
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n{val}\r\n'.encode("utf-8"))

        for field_name, path_str in (("video", req.video_path), ("character_image", req.character_image_path)):
            fpath = Path(path_str)
            mime = mimetypes.guess_type(fpath.name)[0] or "application/octet-stream"
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(
                f'Content-Disposition: form-data; name="{field_name}"; filename="{fpath.name}"\r\n'.encode("utf-8")
            )
            body.extend(f"Content-Type: {mime}\r\n\r\n".encode("utf-8"))
            body.extend(fpath.read_bytes())
            body.extend(b"\r\n")
        body.extend(f"--{boundary}--\r\n".encode("utf-8"))

        request = urllib.request.Request(
            f"{self.base_url}/tasks",
            data=bytes(body),
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=90.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        task_id = data.get("task_id")
        if not task_id:
            raise RuntimeError(f"Wan2.2 Worker 提交失败: {data}")
        return str(task_id)

    def _poll_job(
        self,
        task_id: str,
        timeout_sec: float = 900.0,
        on_progress: Optional[ProgressCallback] = None,
    ) -> None:
        """Poll GET /tasks/{task_id} until SUCCEEDED or FAILED."""
        start_t = time.time()
        while time.time() - start_t < timeout_sec:
            with urllib.request.urlopen(f"{self.base_url}/tasks/{task_id}", timeout=15.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            status = str(data.get("status", "")).upper()
            msg = str(data.get("message") or "正在执行 Wan2.2-Animate...")
            prog = float(data.get("progress") or 0.4)
            self._emit(on_progress, min(0.84, max(0.25, prog)), "wan_animate", msg)
            if status == "SUCCEEDED":
                return
            if status == "FAILED":
                raise RuntimeError(f"Wan2.2 Worker 执行失败: {data.get('error') or msg}")
            time.sleep(3.0)
        raise TimeoutError(f"Wan2.2 Worker 推理超时 ({timeout_sec}s)")

    @staticmethod
    def _emit(cb: Optional[ProgressCallback], progress: float, stage: str, msg: str) -> None:
        if cb:
            cb(progress, stage, msg)
