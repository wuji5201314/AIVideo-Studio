"""Voiceover synthesis (TTS) operator using Edge-TTS.

Follows Alibaba Coding Guidelines:
- Pure stateless execution
- EdgeTTS async streaming
- Atomic audio output file creation
- File length <= 400 lines
"""

from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from packages.studio_engine.models import CostType
from packages.studio_engine.operator_protocol import BaseOperator, CancellationToken
from packages.studio_engine.registry import register_operator


class VoiceInput(BaseModel):
    """Input payload for VoiceOperator."""

    text: str = Field(description="Narration text to synthesize")
    voice_name: str = Field(default="zh-CN-YunxiNeural", description="Voice identifier")
    rate: str = Field(default="+0%", description="Speaking speed rate adjustment, e.g. +15%")
    volume: str = Field(default="+0%", description="Volume adjustment, e.g. +0%")
    output_dir: str = Field(default="storage/temp", description="Target directory for output")


class VoiceOutput(BaseModel):
    """Output payload from VoiceOperator."""

    audio_path: str = Field(description="Absolute path to generated audio file")
    duration_sec: float = Field(default=0.0, description="Duration in seconds")
    file_size_bytes: int = Field(default=0, description="Size in bytes")
    voice_name: str = Field(description="Voice used")


@register_operator
class VoiceOperator(BaseOperator[VoiceInput, VoiceOutput]):
    """Operator that synthesizes single-shot speech audio via Edge-TTS."""

    op_id = "op_voice_tts"
    name = "语音合成算子 (TTS)"
    category = "07-voice-studio"
    description = "高质感人声合成与按句重录，内置普通话及多种方言音色"
    is_free_local = True
    cost_type = CostType.TTS
    input_dto_cls = VoiceInput

    async def execute(
        self,
        input_data: VoiceInput,
        config: Dict[str, Any],
        cancel_token: Optional[CancellationToken] = None,
    ) -> VoiceOutput:
        """Synthesize audio with edge_tts with timeout and cancellation."""
        if cancel_token:
            cancel_token.throw_if_cancelled()

        import edge_tts

        voice = config.get("voice", input_data.voice_name)
        rate = config.get("rate", input_data.rate)
        volume = config.get("volume", input_data.volume)

        out_dir = Path(input_data.output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

        fd, temp_audio_path = tempfile.mkstemp(prefix="tts-", suffix=".mp3", dir=str(out_dir))
        os.close(fd)

        try:
            communicate = edge_tts.Communicate(
                text=input_data.text,
                voice=voice,
                rate=rate,
                volume=volume,
            )

            if cancel_token:
                cancel_token.throw_if_cancelled()

            # Execute TTS generation with timeout
            await asyncio.wait_for(communicate.save(temp_audio_path), timeout=30.0)

            size = os.path.getsize(temp_audio_path)
            # Estimate duration based on mp3 size (~16KB/s for 128kbps) or roughly 4 words per second
            est_duration = max(1.0, len(input_data.text) / 4.0)

            return VoiceOutput(
                audio_path=temp_audio_path,
                duration_sec=round(est_duration, 2),
                file_size_bytes=size,
                voice_name=voice,
            )
        except Exception:
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)
            raise

    def get_input_schema(self) -> Dict[str, Any]:
        """Return input schema for frontend form rendering."""
        return VoiceInput.model_json_schema()
