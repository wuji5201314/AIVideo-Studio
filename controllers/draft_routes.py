"""JianYing Pro Draft Export & Pexels Free HD Stock Footage API routes.

Follows Alibaba Coding Guidelines:
- Thin controller, ResultEnvelope, 5-digit error codes
- File <= 150 lines
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any, Dict, List
from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from controllers.envelope import ErrorCode, ResultEnvelope, StudioBaseError
from packages.studio_engine.jianying_exporter import (
    JianYingDraftExporter,
    JianYingExportRequest,
    detect_jianying_drafts_dir,
)
from packages.studio_engine.pexels_client import PexelsClient

router = APIRouter(prefix="/api/v2", tags=["drafts-and-stock"])


class PexelsDownloadRequest(BaseModel):
    download_url: str = Field(description="Pexels MP4 link to download locally")
    title: str = Field(default="Pexels高清实拍素材")


@router.get("/drafts/jianying/info", response_model=ResultEnvelope[Dict[str, Any]])
async def get_jianying_info() -> ResultEnvelope[Dict[str, Any]]:
    """Detect whether JianYing Pro is installed and return its drafts directory."""
    detected = detect_jianying_drafts_dir()
    return ResultEnvelope.success({
        "detected": detected is not None,
        "drafts_dir": str(detected) if detected else "",
    })


@router.post("/drafts/jianying/export", response_model=ResultEnvelope[Dict[str, Any]])
async def export_jianying_draft(body: JianYingExportRequest) -> ResultEnvelope[Dict[str, Any]]:
    """Export shots/clips + voiceovers + timed subtitles into a JianYing Pro draft."""
    exporter = JianYingDraftExporter()
    try:
        res = await asyncio.to_thread(exporter.export, body)
        return ResultEnvelope.success(res.model_dump())
    except Exception as exc:
        raise StudioBaseError(ErrorCode.INTERNAL_ERROR, f"导出剪映草稿失败: {exc}")


@router.get("/drafts/jianying/download")
async def download_jianying_zip(path: str) -> FileResponse:
    """Download the packaged portable JianYing draft ZIP."""
    target = Path(path).resolve()
    if not target.is_file() or target.suffix.lower() != ".zip":
        raise StudioBaseError(ErrorCode.NOT_FOUND, "剪映草稿压缩包不存在")
    return FileResponse(path=str(target), media_type="application/zip", filename=target.name)


@router.get("/stock/pexels/search", response_model=ResultEnvelope[List[Dict[str, Any]]])
async def search_pexels_videos(
    query: str = "furniture showroom",
    orientation: str = "portrait",
    per_page: int = 8,
) -> ResultEnvelope[List[Dict[str, Any]]]:
    """Search free 1080P HD stock videos on Pexels."""
    client = PexelsClient()
    try:
        items = await asyncio.to_thread(client.search_videos, query, orientation, per_page)
        return ResultEnvelope.success(items)
    except Exception as exc:
        raise StudioBaseError(ErrorCode.INTERNAL_ERROR, str(exc))


@router.post("/stock/pexels/download", response_model=ResultEnvelope[Dict[str, Any]])
async def download_pexels_video(body: PexelsDownloadRequest) -> ResultEnvelope[Dict[str, Any]]:
    """Download a selected Pexels HD stock clip to local storage."""
    if not body.download_url.startswith("http"):
        raise StudioBaseError(ErrorCode.INVALID_PARAM, "无效的 Pexels 视频下载地址")
    client = PexelsClient()
    try:
        local_path = await asyncio.to_thread(client.download_video, body.download_url)
        return ResultEnvelope.success({
            "file_path": str(local_path),
            "filename": local_path.name,
            "size_bytes": os.path.getsize(local_path),
        })
    except Exception as exc:
        raise StudioBaseError(ErrorCode.INTERNAL_ERROR, f"下载 Pexels 素材失败: {exc}")
