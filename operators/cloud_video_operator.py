"""Commercial-grade Cloud Video Generation Operator (T2V / I2V via OpenAI-compatible API).

Supports SiliconFlow (Wan2.2 / Wan2.1), OneAPI / NewAPI relays, and compatible video
generation endpoints — zero local GPU VRAM required.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- File <= 150 lines
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel, Field

from packages.studio_engine.models import CostType
from packages.studio_engine.openai_compat import OpenAICompatClient
from packages.studio_engine.operator_protocol import BaseOperator, CancellationToken
from packages.studio_engine.registry import register_operator

REPO_ROOT = Path(__file__).resolve().parents[1]


class CloudVideoInput(BaseModel):
    """Input payload for cloud AI Text-to-Video / Image-to-Video generation."""

    prompt: str = Field(description="Cinematic video generation prompt")
    image_path: Optional[str] = Field(default=None, description="Optional reference image for Image-to-Video (I2V)")
    aspect_ratio: Literal["9:16", "16:9"] = Field(default="9:16")
    output_dir: str = Field(default="storage/temp")


class CloudVideoOutput(BaseModel):
    """Output payload from CloudVideoGenOperator."""

    video_path: str
    model_used: str
    aspect_ratio: str
    summary_note: str


@register_operator
class CloudVideoGenOperator(BaseOperator[CloudVideoInput, CloudVideoOutput]):
    """Generates cinematic AI videos via configured OpenAI-compatible Cloud Video API."""

    op_id = "op_cloud_video"
    name = "云端 AI 视频生成算子 (T2V/I2V)"
    category = "03-video-gen"
    description = "通过 OpenAI 兼容 / 硅基流动 / OneAPI 接口调用 Wan2.2 等云端模型生成电影级视频（0 显存）"
    is_free_local = False
    cost_type = CostType.VIDEO_GEN
    input_dto_cls = CloudVideoInput

    async def execute(
        self,
        input_data: CloudVideoInput,
        config: Dict[str, Any],
        cancel_token: Optional[CancellationToken] = None,
    ) -> CloudVideoOutput:
        if cancel_token:
            cancel_token.throw_if_cancelled()

        base = Path(input_data.output_dir)
        out_dir = (REPO_ROOT / base).resolve() if not base.is_absolute() else base.resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

        client = OpenAICompatClient()
        _, _, model_name = client.settings.resolve("video")

        out_mp4 = await asyncio.to_thread(
            client.generate_video,
            input_data.prompt.strip(),
            out_dir,
            input_data.image_path,
            input_data.aspect_ratio,
        )
        mode_str = "图生视频 (I2V)" if input_data.image_path else "文生视频 (T2V)"
        return CloudVideoOutput(
            video_path=str(out_mp4),
            model_used=model_name,
            aspect_ratio=input_data.aspect_ratio,
            summary_note=f"已通过云端模型 {model_name} 完成电影级{mode_str}生成",
        )
