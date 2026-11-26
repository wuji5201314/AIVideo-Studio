"""Global Cloud AI API settings routes (OpenAI-compatible relays, SiliconFlow, DeepSeek, OneAPI).

Follows Alibaba Coding Guidelines:
- Thin controller, ResultEnvelope
- File <= 150 lines
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from controllers.envelope import ResultEnvelope
from packages.studio_engine.openai_compat import OpenAICompatClient
from packages.studio_engine.settings_store import SettingsStore

router = APIRouter(prefix="/api/v2/settings", tags=["settings"])


class CloudApiSettingsPatch(BaseModel):
    global_base_url: Optional[str] = None
    global_api_key: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    image_base_url: Optional[str] = None
    image_api_key: Optional[str] = None
    image_model: Optional[str] = None
    video_base_url: Optional[str] = None
    video_api_key: Optional[str] = None
    video_model: Optional[str] = None


@router.get("/api", response_model=ResultEnvelope[Dict[str, Any]])
async def get_cloud_api_settings() -> ResultEnvelope[Dict[str, Any]]:
    """Return masked global OpenAI-compatible API settings."""
    store = SettingsStore()
    settings = store.get_cloud_api_settings()
    return ResultEnvelope.success(store.mask_cloud_api(settings))


@router.put("/api", response_model=ResultEnvelope[Dict[str, Any]])
async def update_cloud_api_settings(patch: CloudApiSettingsPatch) -> ResultEnvelope[Dict[str, Any]]:
    """Persist global OpenAI-compatible API settings."""
    store = SettingsStore()
    updated = store.save_cloud_api_settings(patch.model_dump(exclude_none=True))
    return ResultEnvelope.success(store.mask_cloud_api(updated))


@router.post("/api/test", response_model=ResultEnvelope[Dict[str, Any]])
async def test_cloud_api_connection() -> ResultEnvelope[Dict[str, Any]]:
    """Test real connectivity against configured LLM endpoint."""
    client = OpenAICompatClient()
    result = await asyncio.to_thread(client.test_llm_connection)
    return ResultEnvelope.success(result)
