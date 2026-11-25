"""Digital Human & Wan2.2-Animate API Gateway routes.

Provides:
- Multipart upload for driving videos, character portraits, and custom audio
- Real competitor link/video parsing & scene extraction
- Multi-backend Wan2.2-Animate engine status probe & settings persistence
- Async task submission & stage-by-stage progress polling

Follows Alibaba Coding Guidelines:
- Thin controller, ResultEnvelope, 5-digit error codes
- File length <= 250 lines, Function length <= 80 lines
"""

from __future__ import annotations

import asyncio
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, Field

from controllers.envelope import ErrorCode, ResultEnvelope, StudioBaseError
from operators.avatar_operator import AvatarInput, AvatarOperator
from packages.studio_engine.benchmark_parser import BenchmarkParser
from packages.studio_engine.settings_store import SettingsStore
from packages.studio_engine.wan_animate import WanAnimateRouter

REPO_ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIR = REPO_ROOT / "storage" / "temp" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/api/v2/avatar", tags=["avatar"])

# In-memory async task store for real-time stage progress polling
_AVATAR_TASKS: Dict[str, Dict[str, Any]] = {}


class BenchmarkParseRequest(BaseModel):
    share_url: str = Field(default="")
    local_video_path: Optional[str] = Field(default=None)


class EngineSettingsPatch(BaseModel):
    active_backend: Optional[str] = None
    comfyui_url: Optional[str] = None
    wan_worker_url: Optional[str] = None
    dashscope_api_key: Optional[str] = None
    use_relighting_lora: Optional[bool] = None
    default_resolution: Optional[str] = None
    default_voice: Optional[str] = None


@router.post("/upload", response_model=ResultEnvelope[Dict[str, Any]])
async def upload_avatar_media(
    file: UploadFile = File(...),
    kind: str = Form("video"),
) -> ResultEnvelope[Dict[str, Any]]:
    """Upload driving video, target character portrait, or custom audio file."""
    if not file.filename:
        raise StudioBaseError(ErrorCode.INVALID_PARAM, "上传文件名为空")

    ext = Path(file.filename).suffix.lower() or (".mp4" if kind == "video" else ".png")
    safe_name = f"{kind}_{uuid.uuid4().hex[:10]}{ext}"
    dest = (UPLOAD_DIR / safe_name).resolve()
    content = await file.read()
    if len(content) < 64:
        raise StudioBaseError(ErrorCode.INVALID_PARAM, "上传文件内容为空或已损坏")
    dest.write_bytes(content)

    return ResultEnvelope.success({
        "file_path": str(dest),
        "filename": file.filename,
        "kind": kind,
        "size_bytes": len(content),
    })


@router.post("/benchmark/parse", response_model=ResultEnvelope[Dict[str, Any]])
async def parse_benchmark_video(body: BenchmarkParseRequest) -> ResultEnvelope[Dict[str, Any]]:
    """Parse competitor video link or uploaded MP4, extracting scene video, preview frame, and script."""
    if not body.share_url.strip() and not body.local_video_path:
        raise StudioBaseError(ErrorCode.INVALID_PARAM, "请提供视频链接或上传本地视频文件")

    parser = BenchmarkParser()
    result = await asyncio.to_thread(
        parser.parse_and_extract,
        body.share_url,
        body.local_video_path,
    )
    return ResultEnvelope.success(result.model_dump())


@router.get("/engines", response_model=ResultEnvelope[Dict[str, Any]])
async def get_avatar_engines() -> ResultEnvelope[Dict[str, Any]]:
    """Return persisted engine settings and real-time health of all Wan2.2-Animate backends."""
    store = SettingsStore()
    settings = store.get_avatar_settings()
    router_inst = WanAnimateRouter(settings)
    backends = await asyncio.to_thread(router_inst.probe_all)
    active = router_inst.select_backend()

    return ResultEnvelope.success({
        "settings": store.masked_dict(settings),
        "backends": [b.model_dump() for b in backends],
        "resolved_backend": active.backend_id,
        "resolved_label": active.label,
    })


@router.put("/engines", response_model=ResultEnvelope[Dict[str, Any]])
async def update_avatar_engines(patch: EngineSettingsPatch) -> ResultEnvelope[Dict[str, Any]]:
    """Update persisted Wan2.2-Animate engine configuration and re-probe backends."""
    store = SettingsStore()
    updated = store.save_avatar_settings(patch.model_dump(exclude_none=True))
    router_inst = WanAnimateRouter(updated)
    backends = await asyncio.to_thread(router_inst.probe_all)
    active = router_inst.select_backend()

    return ResultEnvelope.success({
        "settings": store.masked_dict(updated),
        "backends": [b.model_dump() for b in backends],
        "resolved_backend": active.backend_id,
        "resolved_label": active.label,
    })


@router.post("/tasks", response_model=ResultEnvelope[Dict[str, Any]])
async def submit_avatar_task(payload: AvatarInput) -> ResultEnvelope[Dict[str, Any]]:
    """Submit an asynchronous Wan2.2-Animate digital human generation task."""
    task_id = f"avt_{uuid.uuid4().hex[:10]}"
    _AVATAR_TASKS[task_id] = {
        "task_id": task_id,
        "status": "RUNNING",
        "stage": "queued",
        "progress": 0.05,
        "message": "任务已进入执行队列...",
        "logs": ["任务已创建，正在准备推理管线..."],
        "result": None,
        "error": None,
        "created_at": time.time(),
    }

    asyncio.create_task(_run_avatar_task(task_id, payload))
    return ResultEnvelope.success({"task_id": task_id, "status": "RUNNING"})


@router.get("/tasks/{task_id}", response_model=ResultEnvelope[Dict[str, Any]])
async def get_avatar_task(task_id: str) -> ResultEnvelope[Dict[str, Any]]:
    """Poll real-time stage progress and final output of an avatar task."""
    task = _AVATAR_TASKS.get(task_id)
    if not task:
        raise StudioBaseError(ErrorCode.NOT_FOUND, f"任务 {task_id} 不存在")
    return ResultEnvelope.success(task)


async def _run_avatar_task(task_id: str, payload: AvatarInput) -> None:
    """Background coroutine executing AvatarOperator and streaming stage updates."""
    task = _AVATAR_TASKS[task_id]

    def on_progress(progress: float, stage: str, msg: str) -> None:
        task["progress"] = round(progress, 3)
        task["stage"] = stage
        task["message"] = msg
        logs: List[str] = task["logs"]
        if not logs or logs[-1] != msg:
            logs.append(msg)

    try:
        op = AvatarOperator()
        result = await op.execute(payload, {"on_progress": on_progress})
        task["status"] = "SUCCEEDED"
        task["stage"] = "done"
        task["progress"] = 1.0
        task["message"] = "生成完成！"
        task["result"] = result.model_dump()
    except Exception as exc:
        task["status"] = "FAILED"
        task["stage"] = "error"
        task["error"] = str(exc)
        task["message"] = f"生成失败: {exc}"
        task["logs"].append(f"[ERROR] {exc}")
