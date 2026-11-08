"""CAS Asset Management, Library Persistence, and Media Streaming routes.

Follows Alibaba Coding Guidelines:
- Strict path traversal security validation (is_relative_to storage directory)
- File length <= 250 lines
"""

from __future__ import annotations

import json
import mimetypes
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from controllers.envelope import ErrorCode, ResultEnvelope, StudioBaseError
from packages.studio_engine.store import WorkflowStore

router = APIRouter(prefix="/api/v2/assets", tags=["assets"])
_store = WorkflowStore()


def get_store() -> WorkflowStore:
    return _store


class SaveAssetRequest(BaseModel):
    """Request payload for saving a generated temp file or script into CAS library."""

    file_path: Optional[str] = Field(default=None, description="Local path in storage/temp or storage/assets")
    kind: str = Field(default="audio", description="Asset kind: audio, video, image, script")
    title: str = Field(default="未命名素材", description="Human-readable asset title")
    meta: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


def _resolve_safe_storage_path(raw_path: str, store: WorkflowStore) -> Path:
    """Resolve a path and strictly verify it resides inside store.base_dir."""
    base_dir = store.base_dir.resolve()
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = (base_dir.parent / candidate).resolve()
    else:
        candidate = candidate.resolve()

    if not candidate.is_relative_to(base_dir):
        raise StudioBaseError(
            ErrorCode.PARAM_ERROR,
            "Access denied: path is outside managed storage directory",
        )
    if not candidate.exists() or not candidate.is_file():
        raise StudioBaseError(
            ErrorCode.NOT_FOUND,
            f"Media file not found: {candidate.name}",
        )
    return candidate


@router.get("", response_model=ResultEnvelope[List[Dict[str, Any]]])
async def list_assets(
    kind: Optional[str] = Query(default=None, description="Filter by asset kind"),
    store: WorkflowStore = Depends(get_store),
) -> ResultEnvelope[List[Dict[str, Any]]]:
    """List all saved assets in the CAS library."""
    blobs = store.list_blobs(kind=kind)
    items: List[Dict[str, Any]] = []
    for b in blobs:
        abs_path = (store.base_dir / b["rel_path"]).resolve()
        meta = b.get("meta", {})
        items.append({
            "sha256": b["sha256"],
            "kind": b["kind"],
            "title": meta.get("title") or meta.get("filename") or b["sha256"][:12],
            "rel_path": b["rel_path"],
            "file_path": str(abs_path),
            "size_bytes": b["size_bytes"],
            "meta": meta,
            "created_at": b["created_at"],
        })
    return ResultEnvelope.success(items)


@router.post("/save", response_model=ResultEnvelope[Dict[str, Any]])
async def save_to_library(
    payload: SaveAssetRequest,
    store: WorkflowStore = Depends(get_store),
) -> ResultEnvelope[Dict[str, Any]]:
    """Persist a generated temporary file or structured script into the CAS asset pool."""
    meta = dict(payload.meta or {})
    meta["title"] = payload.title

    if payload.file_path:
        target_path = _resolve_safe_storage_path(payload.file_path, store)
        data = target_path.read_bytes()
        ext = target_path.suffix.lstrip(".") or "bin"
        meta["extension"] = ext
        meta["filename"] = target_path.name
    else:
        data = json.dumps(meta, ensure_ascii=False, indent=2).encode("utf-8")
        meta["extension"] = "json"
        meta["filename"] = f"{payload.title}.json"

    sha256 = store.put_blob(kind=payload.kind, data=data, meta=meta)
    saved_path = store.get_blob_path(sha256)

    return ResultEnvelope.success({
        "sha256": sha256,
        "kind": payload.kind,
        "title": payload.title,
        "size_bytes": len(data),
        "file_path": str(saved_path) if saved_path else payload.file_path,
    })


@router.post("/upload", response_model=ResultEnvelope[dict])
async def upload_asset(
    file: UploadFile = File(...),
    store: WorkflowStore = Depends(get_store),
) -> ResultEnvelope[dict]:
    """Upload a file directly into the Content-Addressed Storage (CAS) pool."""
    content = await file.read()
    ext = Path(file.filename or "file").suffix.lstrip(".")
    sha256 = store.put_blob(
        kind="upload",
        data=content,
        meta={"filename": file.filename, "title": file.filename, "extension": ext},
    )
    return ResultEnvelope.success({
        "sha256": sha256,
        "filename": file.filename,
        "size_bytes": len(content),
    })


@router.get("/stream")
async def stream_media(
    path: Optional[str] = Query(default=None, description="File path inside storage"),
    sha256: Optional[str] = Query(default=None, description="CAS SHA256 hash"),
    store: WorkflowStore = Depends(get_store),
) -> FileResponse:
    """Stream audio/video/image file from storage/temp or storage/assets for browser playback."""
    if sha256:
        if not sha256.isalnum() or len(sha256) != 64:
            raise HTTPException(status_code=400, detail="Invalid SHA256 identifier")
        resolved = store.get_blob_path(sha256)
        if not resolved or not resolved.exists():
            raise HTTPException(status_code=404, detail="Asset not found")
    elif path:
        try:
            resolved = _resolve_safe_storage_path(path, store)
        except StudioBaseError as exc:
            raise HTTPException(status_code=404, detail=exc.message)
    else:
        raise HTTPException(status_code=400, detail="Either path or sha256 query parameter is required")

    mime_type, _ = mimetypes.guess_type(str(resolved))
    if not mime_type:
        suffix = resolved.suffix.lower()
        if suffix == ".mp3":
            mime_type = "audio/mpeg"
        elif suffix == ".mp4":
            mime_type = "video/mp4"
        elif suffix == ".wav":
            mime_type = "audio/wav"
        else:
            mime_type = "application/octet-stream"

    return FileResponse(resolved, media_type=mime_type)


@router.get("/{sha256}")
async def get_asset(
    sha256: str,
    store: WorkflowStore = Depends(get_store),
) -> FileResponse:
    """Download or stream CAS asset with directory traversal protection."""
    if not sha256.isalnum() or len(sha256) != 64:
        raise HTTPException(status_code=400, detail="Invalid SHA256 identifier")

    path = store.get_blob_path(sha256)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Asset not found")

    assets_dir = store.assets_dir.resolve()
    if not path.resolve().is_relative_to(assets_dir):
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(path)
