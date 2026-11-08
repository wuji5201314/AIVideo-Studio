"""CAS Asset Management and streaming routes.

Follows Alibaba Coding Guidelines:
- Path traversal security validation
- File length <= 250 lines
"""

from __future__ import annotations

from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from controllers.envelope import ErrorCode, ResultEnvelope, StudioBaseError
from packages.studio_engine.store import WorkflowStore

router = APIRouter(prefix="/api/v2/assets", tags=["assets"])
_store = WorkflowStore()


def get_store() -> WorkflowStore:
    return _store


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
        meta={"filename": file.filename, "extension": ext},
    )
    return ResultEnvelope.success({
        "sha256": sha256,
        "filename": file.filename,
        "size_bytes": len(content),
    })


@router.get("/{sha256}")
async def get_asset(
    sha256: str,
    store: WorkflowStore = Depends(get_store),
) -> FileResponse:
    """Download or stream CAS asset with directory traversal protection."""
    # Enforce safe sha256 hex string pattern
    if not sha256.isalnum() or len(sha256) != 64:
        raise HTTPException(status_code=400, detail="Invalid SHA256 identifier")

    path = store.get_blob_path(sha256)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Asset not found")

    # Enforce path is strictly inside assets directory
    assets_dir = store.assets_dir.resolve()
    if not path.resolve().is_relative_to(assets_dir):
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(path)
