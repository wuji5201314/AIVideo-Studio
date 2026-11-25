"""Open-source ComfyUI client for Wan2.2-Animate workflows.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- File <= 300 lines, Function <= 80 lines
- Pure stdlib urllib (zero extra client dependency)
"""

from __future__ import annotations

import json
import mimetypes
import os
import time
import urllib.error
import urllib.parse
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

WORKFLOWS_DIR = Path(__file__).resolve().parent / "workflows"


class ComfyUIWanAnimateBackend(BaseWanAnimateBackend):
    """Dispatches Wan2.2-Animate Replace/Move jobs to an open-source ComfyUI instance."""

    backend_id = "comfyui"
    label = "ComfyUI · Wan2.2-Animate-14B (开源)"

    def __init__(self, base_url: str = "http://127.0.0.1:8188") -> None:
        self.base_url = base_url.rstrip("/")

    def check_health(self, timeout: float = 2.0) -> BackendHealth:
        """Probe ComfyUI /system_stats endpoint."""
        url = f"{self.base_url}/system_stats"
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
            devices = data.get("devices") or []
            gpu_name = devices[0].get("name", "GPU") if devices else "ComfyUI Online"
            return BackendHealth(
                backend_id=self.backend_id,
                label=self.label,
                available=True,
                endpoint=self.base_url,
                detail=f"已连接 ({gpu_name})",
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
        """Upload media, submit Wan2.2-Animate workflow, poll history, and download MP4."""
        self._emit(on_progress, 0.12, "preprocess", "正在上传原视频与目标人物图到 ComfyUI...")
        uploaded_video = self._upload_file(Path(req.video_path))
        uploaded_image = self._upload_file(Path(req.character_image_path))

        workflow = self._load_and_patch_workflow(req, uploaded_video, uploaded_image)
        self._emit(on_progress, 0.25, "wan_animate", f"正在提交 Wan2.2-Animate ({req.mode}) 工作流队列...")
        prompt_id = self._submit_prompt(workflow)

        self._emit(on_progress, 0.35, "wan_animate", "Wan2.2-Animate-14B 正在进行姿态提取、SAM2遮罩与扩散生成...")
        output_file_info = self._poll_history(prompt_id, on_progress=on_progress)

        self._emit(on_progress, 0.85, "wan_animate", "正在拉取 Wan2.2-Animate 生成的成片...")
        out_dir = Path(req.output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"wan22-comfy-{req.mode}-{uuid.uuid4().hex[:8]}.mp4"
        self._download_output(output_file_info, out_path)

        return WanAnimateResult(
            video_path=str(out_path),
            backend_id=self.backend_id,
            backend_label=self.label,
            mode=req.mode,
            is_neural_wan=True,
            note=f"ComfyUI Wan2.2-Animate-14B ({req.mode}) 推理完成",
        )

    def _upload_file(self, file_path: Path) -> str:
        """Multipart upload file to ComfyUI /upload/image endpoint."""
        if not file_path.is_file():
            raise FileNotFoundError(f"媒体文件不存在: {file_path}")
        boundary = f"----AIVideoStudio{uuid.uuid4().hex}"
        mime = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        file_bytes = file_path.read_bytes()

        body = bytearray()
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(
            f'Content-Disposition: form-data; name="image"; filename="{file_path.name}"\r\n'.encode("utf-8")
        )
        body.extend(f"Content-Type: {mime}\r\n\r\n".encode("utf-8"))
        body.extend(file_bytes)
        body.extend(f"\r\n--{boundary}\r\n".encode("utf-8"))
        body.extend(b'Content-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n')
        body.extend(f"--{boundary}--\r\n".encode("utf-8"))

        request = urllib.request.Request(
            f"{self.base_url}/upload/image",
            data=bytes(body),
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=60.0) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return str(result.get("name") or file_path.name)

    def _load_and_patch_workflow(
        self,
        req: WanAnimateRequest,
        video_name: str,
        image_name: str,
    ) -> Dict[str, Any]:
        """Load built-in Wan2.2-Animate workflow JSON and inject runtime inputs."""
        wf_file = WORKFLOWS_DIR / (
            "wan22_animate_replace.json" if req.mode == "replace" else "wan22_animate_move.json"
        )
        raw_text = wf_file.read_text(encoding="utf-8")
        raw_text = raw_text.replace("__DRIVING_VIDEO__", video_name)
        raw_text = raw_text.replace("__CHARACTER_IMAGE__", image_name)
        wf: Dict[str, Any] = json.loads(raw_text)

        width, height = (480, 832) if req.resolution == "480p" else (720, 1280)
        if "7" in wf and "inputs" in wf["7"]:
            wf["7"]["inputs"]["width"] = width
            wf["7"]["inputs"]["height"] = height
        if "6" in wf and "inputs" in wf["6"]:
            wf["6"]["inputs"]["enabled"] = bool(req.use_relighting_lora)
        return wf

    def _submit_prompt(self, workflow: Dict[str, Any]) -> str:
        """POST workflow prompt to ComfyUI and return prompt_id."""
        payload = json.dumps({"prompt": workflow, "client_id": f"studio_{uuid.uuid4().hex[:8]}"}).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/prompt",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=30.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        prompt_id = data.get("prompt_id")
        if not prompt_id:
            raise RuntimeError(f"ComfyUI 提交失败: {data}")
        return str(prompt_id)

    def _poll_history(
        self,
        prompt_id: str,
        timeout_sec: float = 600.0,
        on_progress: Optional[ProgressCallback] = None,
    ) -> Dict[str, str]:
        """Poll ComfyUI /history/{prompt_id} until output video is ready."""
        start_t = time.time()
        while time.time() - start_t < timeout_sec:
            url = f"{self.base_url}/history/{urllib.parse.quote(prompt_id)}"
            with urllib.request.urlopen(url, timeout=15.0) as resp:
                hist = json.loads(resp.read().decode("utf-8"))
            if prompt_id in hist:
                outputs = hist[prompt_id].get("outputs") or {}
                for node_out in outputs.values():
                    for key in ("gifs", "videos", "images"):
                        items = node_out.get(key) or []
                        for item in items:
                            fname = str(item.get("filename", ""))
                            if fname.endswith((".mp4", ".webm", ".mov")):
                                return {
                                    "filename": fname,
                                    "subfolder": str(item.get("subfolder", "")),
                                    "type": str(item.get("type", "output")),
                                }
                raise RuntimeError("ComfyUI 工作流执行结束，但未产出 MP4 视频文件")
            elapsed = time.time() - start_t
            pct = min(0.82, 0.35 + (elapsed / max(timeout_sec, 1.0)) * 0.45)
            self._emit(on_progress, pct, "wan_animate", f"Wan2.2-Animate 正在推理中 ({int(elapsed)}s)...")
            time.sleep(3.0)
        raise TimeoutError(f"ComfyUI 推理超时 ({timeout_sec}s)")

    def _download_output(self, info: Dict[str, str], dest: Path) -> None:
        """Download rendered MP4 from ComfyUI /view endpoint."""
        qs = urllib.parse.urlencode(info)
        url = f"{self.base_url}/view?{qs}"
        with urllib.request.urlopen(url, timeout=120.0) as resp:
            dest.write_bytes(resp.read())

    @staticmethod
    def _emit(cb: Optional[ProgressCallback], progress: float, stage: str, msg: str) -> None:
        if cb:
            cb(progress, stage, msg)
