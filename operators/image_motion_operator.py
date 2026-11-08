"""Image Motion Operator: Ken Burns 7 camera motions on still images.

Follows Alibaba Coding Guidelines:
- Clean subprocess parameter list (no shell=True)
- Timeout control and atomic file creation
- File length <= 400 lines
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from packages.studio_engine.models import CostType
from packages.studio_engine.operator_protocol import BaseOperator, CancellationToken
from packages.studio_engine.registry import register_operator


class ImageMotionInput(BaseModel):
    """Input payload for ImageMotionOperator."""

    image_path: str = Field(description="Source image path")
    motion_type: str = Field(default="zoom_in", description="zoom_in, zoom_out, pan_left, pan_right, tilt_up, tilt_down, static")
    duration_sec: float = Field(default=3.5, ge=1.0, le=30.0, description="Clip duration in seconds")
    aspect_ratio: str = Field(default="9:16", description="9:16 or 16:9")
    output_dir: str = Field(default="storage/temp", description="Output directory")


class ImageMotionOutput(BaseModel):
    """Output payload from ImageMotionOperator."""

    clip_path: str = Field(description="Rendered scene clip path")
    duration_sec: float
    width: int
    height: int


@register_operator
class ImageMotionOperator(BaseOperator[ImageMotionInput, ImageMotionOutput]):
    """Turns still images into dynamic cinematic video clips via local FFmpeg."""

    op_id = "op_image_motion"
    name = "静图运镜算子"
    category = "03-video-gen"
    description = "零成本将静态图片转化为推拉摇移（Ken Burns）电影感动态片段"
    is_free_local = True
    cost_type = CostType.FFMPEG
    input_dto_cls = ImageMotionInput

    MOTIONS: Dict[str, str] = {
        "zoom_in": "zoompan=z='min(zoom+0.0015,1.25)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
        "zoom_out": "zoompan=z='if(lte(zoom,1.0),1.25,max(1.001,zoom-0.0015))':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
        "pan_left": "zoompan=z=1.15:d=125:x='if(lte(on,1),(iw-iw/zoom)/2,max(0,x-1.5))':y='(ih-ih/zoom)/2'",
        "pan_right": "zoompan=z=1.15:d=125:x='if(lte(on,1),0,min(iw-iw/zoom,x+1.5))':y='(ih-ih/zoom)/2'",
        "tilt_up": "zoompan=z=1.15:d=125:x='(iw-iw/zoom)/2':y='if(lte(on,1),(ih-ih/zoom)/2,max(0,y-1.5))'",
        "tilt_down": "zoompan=z=1.15:d=125:x='(iw-iw/zoom)/2':y='if(lte(on,1),0,min(ih-ih/zoom,y+1.5))'",
        "static": "scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}",
    }

    async def execute(
        self,
        input_data: ImageMotionInput,
        config: Dict[str, Any],
        cancel_token: Optional[CancellationToken] = None,
    ) -> ImageMotionOutput:
        """Render motion video clip from image."""
        if cancel_token:
            cancel_token.throw_if_cancelled()

        w, h = (1080, 1920) if input_data.aspect_ratio == "9:16" else (1920, 1080)
        motion_key = config.get("motion", input_data.motion_type)
        base_filter = self.MOTIONS.get(motion_key, self.MOTIONS["zoom_in"])

        if "{w}" in base_filter:
            vf = base_filter.format(w=w, h=h)
        else:
            vf = f"{base_filter}:s={w}x{h},format=yuv420p"

        out_dir = Path(input_data.output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        fd, out_path = tempfile.mkstemp(prefix="motion-clip-", suffix=".mp4", dir=str(out_dir))
        os.close(fd)

        cmd = [
            "ffmpeg", "-y",
            "-loop", "1",
            "-i", input_data.image_path,
            "-vf", vf,
            "-t", str(input_data.duration_sec),
            "-r", "30",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            out_path,
        ]

        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45.0)

        return ImageMotionOutput(
            clip_path=out_path,
            duration_sec=input_data.duration_sec,
            width=w,
            height=h,
        )

    def get_input_schema(self) -> Dict[str, Any]:
        """Return input schema for frontend form rendering."""
        return ImageMotionInput.model_json_schema()
