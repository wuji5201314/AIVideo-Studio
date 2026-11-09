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
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from PIL import Image, ImageDraw, ImageFont, ImageOps
from packages.studio_engine.models import CostType
from packages.studio_engine.operator_protocol import BaseOperator, CancellationToken
from packages.studio_engine.registry import register_operator


class ImageMotionInput(BaseModel):
    """Input payload for ImageMotionOperator."""

    image_path: str = Field(default="", description="Source image local path or HTTP URL")
    prompt_title: str = Field(default="电影感推拉运镜画面", description="Optional label or visual title")
    motion_type: str = Field(default="zoom_in", description="zoom_in, zoom_out, pan_left, pan_right, tilt_up, tilt_down, static")
    duration_sec: float = Field(default=4.0, ge=1.0, le=30.0, description="Clip duration in seconds")
    aspect_ratio: str = Field(default="9:16", description="9:16, 16:9, or 1:1")
    output_dir: str = Field(default="storage/temp", description="Output directory")


class ImageMotionOutput(BaseModel):
    """Output payload from ImageMotionOperator."""

    clip_path: str = Field(description="Rendered scene clip path")
    video_path: str = Field(description="Alias for rendered MP4 path")
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
        "zoom_in": "zoompan=z='min(zoom+0.0018,1.25)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
        "zoom_out": "zoompan=z='if(lte(zoom,1.0),1.25,max(1.001,zoom-0.0018))':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
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
        """Render motion video clip from local/remote image."""
        if cancel_token:
            cancel_token.throw_if_cancelled()

        w, h = (1080, 1920) if input_data.aspect_ratio == "9:16" else ((1920, 1080) if input_data.aspect_ratio == "16:9" else (1080, 1080))
        out_dir = Path(input_data.output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        cleanup_files: List[str] = []

        try:
            local_img = self._prepare_source_image(input_data, w, h, out_dir, cleanup_files)
            motion_key = config.get("motion", input_data.motion_type)
            base_filter = self.MOTIONS.get(motion_key, self.MOTIONS["zoom_in"])

            if "{w}" in base_filter:
                vf = f"{base_filter.format(w=w, h=h)},format=yuv420p"
            else:
                vf = f"{base_filter}:s={w}x{h},format=yuv420p"

            fd, out_path = tempfile.mkstemp(prefix="motion-clip-", suffix=".mp4", dir=str(out_dir))
            os.close(fd)

            cmd = [
                "ffmpeg", "-y",
                "-loop", "1", "-i", local_img,
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
                video_path=out_path,
                duration_sec=input_data.duration_sec,
                width=w,
                height=h,
            )
        finally:
            for f in cleanup_files:
                if os.path.exists(f):
                    try:
                        os.remove(f)
                    except OSError:
                        pass

    def _prepare_source_image(
        self,
        input_data: ImageMotionInput,
        w: int,
        h: int,
        out_dir: Path,
        cleanup_files: List[str],
    ) -> str:
        """Resolve HTTP image or generate a studio sample frame if needed."""
        src = input_data.image_path.strip()
        if src.startswith("http://") or src.startswith("https://"):
            try:
                fd, dl_path = tempfile.mkstemp(prefix="motion-src-", suffix=".jpg", dir=str(out_dir))
                os.close(fd)
                cleanup_files.append(dl_path)
                req = urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=4.0) as resp, open(dl_path, "wb") as f:
                    f.write(resp.read())
                src = dl_path
            except Exception:
                src = ""

        if src and os.path.exists(src):
            try:
                img = Image.open(src).convert("RGB")
                fitted = ImageOps.fit(img, (w, h), method=Image.Resampling.LANCZOS)
                fd, norm_path = tempfile.mkstemp(prefix="motion-norm-", suffix=".png", dir=str(out_dir))
                os.close(fd)
                cleanup_files.append(norm_path)
                fitted.save(norm_path)
                return norm_path
            except Exception:
                pass

        # Fallback generated visual frame
        canvas = Image.new("RGB", (w, h), color=(18, 26, 42))
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle([80, int(h * 0.35), w - 80, int(h * 0.65)], radius=32, fill=(28, 42, 68), outline=(0, 113, 227), width=4)
        font_path = "C:/Windows/Fonts/msyhbd.ttc"
        font = ImageFont.truetype(font_path, 48) if os.path.exists(font_path) else ImageFont.load_default()
        draw.text((130, int(h * 0.46)), input_data.prompt_title or "Ken Burns 电影级静图运镜", font=font, fill=(255, 255, 255))
        fd, gen_path = tempfile.mkstemp(prefix="motion-gen-", suffix=".png", dir=str(out_dir))
        os.close(fd)
        cleanup_files.append(gen_path)
        canvas.save(gen_path)
        return gen_path

    def get_input_schema(self) -> Dict[str, Any]:
        """Return input schema for frontend form rendering."""
        return ImageMotionInput.model_json_schema()
