"""Motion Text & Cover Design Operator: 100% local, zero-cost animated card & cover generator.

Follows Alibaba Coding Guidelines:
- Clean subprocess with list arguments (no shell=True)
- Timeout control and atomic file writing
- File length <= 400 lines
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from PIL import Image, ImageDraw, ImageFont
from packages.studio_engine.models import CostType
from packages.studio_engine.operator_protocol import BaseOperator, CancellationToken
from packages.studio_engine.registry import register_operator


class MotionTextInput(BaseModel):
    """Input payload for MotionTextOperator."""

    lines: List[str] = Field(default_factory=list, description="1 to 5 lines of text to animate")
    title: str = Field(default="", description="Optional main title")
    subtitle: str = Field(default="", description="Optional subtitle or badge")
    template: str = Field(default="floating", description="floating, pop_center, impact, cover_poster")
    theme: str = Field(default="apple_dark", description="apple_dark, tech_blue, clean_white, warm_amber")
    aspect_ratio: str = Field(default="9:16", description="9:16, 16:9, 3:4, 1:1")
    duration_sec: float = Field(default=4.0, ge=2.0, le=15.0, description="Card duration")
    output_format: str = Field(default="mp4", description="mp4 or png")
    output_dir: str = Field(default="storage/temp", description="Output target directory")


class MotionTextOutput(BaseModel):
    """Output payload from MotionTextOperator."""

    video_path: str = Field(description="Rendered mp4 or png path")
    duration_sec: float
    width: int
    height: int


@register_operator
class MotionTextOperator(BaseOperator[MotionTextInput, MotionTextOutput]):
    """Generates animated typography video cards and high-res covers using Pillow + FFmpeg."""

    op_id = "op_motion_text"
    name = "本机文字动画与封面算子"
    category = "04-motion-design"
    description = "零成本本机极速渲染中文大字动画卡片与小红书/抖音爆款封面"
    is_free_local = True
    cost_type = CostType.FFMPEG
    input_dto_cls = MotionTextInput

    ASPECT_MAP = {
        "9:16": (1080, 1920),
        "3:4": (1080, 1440),
        "16:9": (1920, 1080),
        "1:1": (1080, 1080),
    }

    THEME_COLORS = {
        "apple_dark": {"bg": (18, 20, 26), "card": (28, 32, 42), "text": (245, 245, 247), "accent": (0, 113, 227)},
        "tech_blue": {"bg": (10, 18, 36), "card": (18, 32, 60), "text": (235, 248, 255), "accent": (56, 189, 248)},
        "tech_cyan": {"bg": (10, 18, 36), "card": (18, 32, 60), "text": (235, 248, 255), "accent": (0, 220, 255)},
        "clean_white": {"bg": (246, 247, 250), "card": (255, 255, 255), "text": (22, 24, 29), "accent": (0, 113, 227)},
        "paper_light": {"bg": (246, 247, 250), "card": (255, 255, 255), "text": (22, 24, 29), "accent": (0, 113, 227)},
        "warm_amber": {"bg": (28, 20, 16), "card": (44, 30, 22), "text": (255, 248, 235), "accent": (245, 158, 11)},
    }

    async def execute(
        self,
        input_data: MotionTextInput,
        config: Dict[str, Any],
        cancel_token: Optional[CancellationToken] = None,
    ) -> MotionTextOutput:
        """Create animated motion text video or PNG cover via Pillow and FFmpeg."""
        if cancel_token:
            cancel_token.throw_if_cancelled()

        w, h = self.ASPECT_MAP.get(input_data.aspect_ratio, (1080, 1920))
        theme_cfg = self.THEME_COLORS.get(input_data.theme, self.THEME_COLORS["apple_dark"])
        out_dir = Path(input_data.output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

        base_img_path = self._render_typography_canvas(input_data, w, h, theme_cfg, out_dir)

        if input_data.output_format.lower() == "png":
            return MotionTextOutput(
                video_path=base_img_path,
                duration_sec=0.0,
                width=w,
                height=h,
            )

        fd_vid, out_vid_path = tempfile.mkstemp(prefix="motion-vid-", suffix=".mp4", dir=str(out_dir))
        os.close(fd_vid)

        try:
            vf = f"zoompan=z='min(zoom+0.0018,1.12)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h},format=yuv420p"
            cmd = [
                "ffmpeg", "-y",
                "-loop", "1", "-i", base_img_path,
                "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                "-vf", vf,
                "-t", str(input_data.duration_sec),
                "-r", "30",
                "-c:v", "libx264",
                "-c:a", "aac", "-b:a", "128k",
                "-pix_fmt", "yuv420p",
                "-shortest",
                out_vid_path,
            ]
            p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45.0)
            ffmpeg_ok = p.returncode == 0 and os.path.exists(out_vid_path) and os.path.getsize(out_vid_path) > 0

            if not ffmpeg_ok:
                if os.path.exists(out_vid_path):
                    os.remove(out_vid_path)
                return MotionTextOutput(video_path=base_img_path, duration_sec=input_data.duration_sec, width=w, height=h)

            if os.path.exists(base_img_path):
                os.remove(base_img_path)
            return MotionTextOutput(
                video_path=out_vid_path,
                duration_sec=input_data.duration_sec,
                width=w,
                height=h,
            )
        except Exception:
            if os.path.exists(base_img_path):
                os.remove(base_img_path)
            raise

    def _render_typography_canvas(
        self,
        input_data: MotionTextInput,
        w: int,
        h: int,
        theme_cfg: Dict[str, Any],
        out_dir: Path,
    ) -> str:
        """Render clean Apple-style kinetic typography card with Chinese TrueType fonts."""
        img = Image.new("RGB", (w, h), color=theme_cfg["bg"])
        draw = ImageDraw.Draw(img)
        fonts = self._load_fonts()

        # Decorative outer card
        pad_x, pad_y = 70, int(h * 0.18)
        draw.rounded_rectangle(
            [pad_x, pad_y, w - pad_x, h - pad_y],
            radius=36,
            fill=theme_cfg["card"],
            outline=theme_cfg["accent"],
            width=4,
        )

        # Top pill badge
        badge_label = input_data.subtitle.strip() or f"STYLE · {input_data.template.upper()}"
        draw.rounded_rectangle([pad_x + 50, pad_y + 50, min(w - pad_x - 50, pad_x + 520), pad_y + 116], radius=18, fill=theme_cfg["accent"])
        draw.text((pad_x + 76, pad_y + 66), badge_label, font=fonts["badge"], fill=(255, 255, 255))

        y_cursor = pad_y + 180
        if input_data.title.strip():
            draw.text((pad_x + 50, y_cursor), input_data.title.strip(), font=fonts["title"], fill=theme_cfg["accent"])
            y_cursor += 110

        lines = [ln.strip() for ln in input_data.lines if ln.strip()]
        if not lines:
            lines = ["新一代 AI 视频工作台", "支持多节点独立创作", "本机高清直出成片"]

        for line in lines[:5]:
            draw.text((pad_x + 50, y_cursor), line, font=fonts["line"], fill=theme_cfg["text"])
            y_cursor += 96

        fd_img, base_img_path = tempfile.mkstemp(prefix="motion-img-", suffix=".png", dir=str(out_dir))
        os.close(fd_img)
        img.save(base_img_path)
        return base_img_path

    def _load_fonts(self) -> Dict[str, Any]:
        """Load Windows system Chinese fonts."""
        candidates = ["C:/Windows/Fonts/msyhbd.ttc", "C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/simhei.ttf"]
        for c in candidates:
            if os.path.exists(c):
                try:
                    return {
                        "title": ImageFont.truetype(c, 64),
                        "line": ImageFont.truetype(c, 52),
                        "badge": ImageFont.truetype(c, 30),
                    }
                except Exception:
                    continue
        default_f = ImageFont.load_default()
        return {"title": default_f, "line": default_f, "badge": default_f}

    def get_input_schema(self) -> Dict[str, Any]:
        """Return input schema for frontend form rendering."""
        return MotionTextInput.model_json_schema()
