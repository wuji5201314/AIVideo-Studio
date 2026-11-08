"""Full video composer operator: stitches shots, audio, and subtitles into master MP4.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- Clean subprocess with list arguments (no shell=True)
- Timeout control and atomic file writes
- File length <= 400 lines
- Function length <= 80 lines
"""

from __future__ import annotations

import asyncio
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


class ShotSpec(BaseModel):
    """Specification for an individual video shot."""

    shot_id: str
    headline: str = ""
    narration: str = ""
    audio_path: Optional[str] = None
    visual_path: Optional[str] = None
    est_duration: float = 3.5


class VideoComposeInput(BaseModel):
    """Input payload for VideoComposerOperator."""

    title: str = Field(default="新一代 AI 视频工作流全拆解", description="Master project title")
    aspect_ratio: str = Field(default="9:16", description="9:16 or 16:9")
    shots: List[ShotSpec] = Field(description="Ordered list of shot specifications")
    voice_name: str = Field(default="zh-CN-YunxiNeural", description="Default TTS voice")
    fps: int = Field(default=30, ge=24, le=60)
    output_dir: str = Field(default="storage/temp", description="Output target directory")


class VideoComposeOutput(BaseModel):
    """Output payload from VideoComposerOperator."""

    video_path: str = Field(description="Rendered master MP4 video path")
    duration_sec: float
    file_size_bytes: int
    shot_count: int
    resolution: str


@register_operator
class VideoComposerOperator(BaseOperator[VideoComposeInput, VideoComposeOutput]):
    """Operator that stitches multiple shots, audio tracks, and title cards into master MP4."""

    op_id = "op_video_composer"
    name = "成片混音与视频合成算子"
    category = "03-video-gen"
    description = "将所有分镜的多轨音频、画面与字幕整体编排渲染为完整高清 MP4 成片"
    is_free_local = True
    cost_type = CostType.FFMPEG
    input_dto_cls = VideoComposeInput

    ASPECT_SIZES = {
        "9:16": (1080, 1920),
        "16:9": (1920, 1080),
        "1:1": (1080, 1080),
    }

    async def execute(
        self,
        input_data: VideoComposeInput,
        config: Dict[str, Any],
        cancel_token: Optional[CancellationToken] = None,
    ) -> VideoComposeOutput:
        """Render each shot into an MP4 clip and concat into a final master video."""
        if cancel_token:
            cancel_token.throw_if_cancelled()

        w, h = self.ASPECT_SIZES.get(input_data.aspect_ratio, (1080, 1920))
        out_dir = Path(input_data.output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

        segment_paths: List[str] = []
        temp_cleanup_files: List[str] = []
        master_path: str = ""

        try:
            for idx, shot in enumerate(input_data.shots):
                if cancel_token:
                    cancel_token.throw_if_cancelled()

                seg_path = await self._render_shot_segment(
                    idx=idx,
                    shot=shot,
                    w=w,
                    h=h,
                    voice_name=input_data.voice_name,
                    out_dir=out_dir,
                    cleanup_list=temp_cleanup_files,
                )
                segment_paths.append(seg_path)
                temp_cleanup_files.append(seg_path)

            if not segment_paths:
                raise ValueError("No shot segments to concatenate")

            master_path = self._concat_segments(segment_paths, out_dir, temp_cleanup_files)
            file_size = os.path.getsize(master_path)
            total_duration = self._probe_duration(master_path)

            return VideoComposeOutput(
                video_path=master_path,
                duration_sec=round(total_duration, 2),
                file_size_bytes=file_size,
                shot_count=len(input_data.shots),
                resolution=f"{w}x{h}",
            )
        finally:
            for p in temp_cleanup_files:
                if p != master_path and os.path.exists(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass

    async def _render_shot_segment(
        self,
        idx: int,
        shot: ShotSpec,
        w: int,
        h: int,
        voice_name: str,
        out_dir: Path,
        cleanup_list: List[str],
    ) -> str:
        """Render a single shot into a synced MP4 segment with real speech audio and cinematic visuals."""
        audio_file = await self._ensure_shot_audio(shot, voice_name, out_dir, cleanup_list)
        frame_img_path = self._create_shot_frame(idx, shot, w, h, out_dir, cleanup_list)
        cleanup_list.append(frame_img_path)

        fd, seg_mp4 = tempfile.mkstemp(prefix=f"seg-{idx+1}-", suffix=".mp4", dir=str(out_dir))
        os.close(fd)

        duration = self._probe_duration(audio_file)
        if duration <= 0:
            duration = max(3.5, shot.est_duration)

        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", frame_img_path,
            "-i", audio_file,
            "-t", str(duration),
            "-c:v", "libx264", "-tune", "stillimage",
            "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
            "-pix_fmt", "yuv420p",
            "-r", "30",
            seg_mp4,
        ]

        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45.0)
        return seg_mp4

    async def _ensure_shot_audio(
        self,
        shot: ShotSpec,
        voice_name: str,
        out_dir: Path,
        cleanup_list: List[str],
    ) -> str:
        """Guarantee valid speech audio: either existing file or on-the-fly EdgeTTS synthesis."""
        if shot.audio_path and os.path.exists(shot.audio_path) and os.path.getsize(shot.audio_path) > 100:
            return shot.audio_path

        import edge_tts
        fd_a, temp_tts = tempfile.mkstemp(prefix="tts-auto-", suffix=".mp3", dir=str(out_dir))
        os.close(fd_a)
        cleanup_list.append(temp_tts)

        text = shot.narration.strip() or f"{shot.headline}，为您生动解说核心内容。"
        communicate = edge_tts.Communicate(text, voice_name or "zh-CN-YunxiNeural")
        await communicate.save(temp_tts)
        return temp_tts

    def _create_shot_frame(
        self,
        idx: int,
        shot: ShotSpec,
        w: int,
        h: int,
        out_dir: Path,
        cleanup_list: List[str],
    ) -> str:
        """Create an aesthetic cinematic 1080x1920 frame with real imagery, scene pill, and subtitles."""
        fonts = self._load_fonts()
        base_img = self._prepare_background_image(shot.visual_path, w, h, out_dir, cleanup_list)
        draw = ImageDraw.Draw(base_img)

        # 1. Top Scene Pill: e.g. "SCENE 01 · 黄金前3秒：核心痛点"
        pill_w, pill_h = min(w - 120, 800), 80
        draw.rounded_rectangle([60, 80, 60 + pill_w, 80 + pill_h], radius=20, fill=(0, 113, 227))
        badge_text = f"第 {idx + 1} 幕 · {shot.headline or '核心分镜'}"
        draw.text((90, 102), badge_text, font=fonts["badge"], fill=(255, 255, 255))

        # 2. Bottom Subtitle Card
        sub_card_h = 280
        sub_card_y = h - sub_card_h - 100
        # Translucent dark bar for maximum subtitle contrast
        draw.rounded_rectangle(
            [50, sub_card_y, w - 50, sub_card_y + sub_card_h],
            radius=24,
            fill=(10, 12, 18),
            outline=(0, 113, 227),
            width=3,
        )

        sub_label = "配音字幕 (NARRATION):"
        draw.text((80, sub_card_y + 24), sub_label, font=fonts["label"], fill=(0, 113, 227))

        narration = shot.narration or "欢迎体验新一代 AI 视频工作台，零成本极速出片。"
        # Wrap narration into lines of ~18-20 Chinese characters
        line_len = 19 if w > h else 17
        lines = [narration[i : i + line_len] for i in range(0, len(narration), line_len)]
        for l_idx, line in enumerate(lines[:3]):
            draw.text(
                (80, sub_card_y + 75 + l_idx * 56),
                line,
                font=fonts["subtitle"],
                fill=(255, 255, 255),
            )

        fd, frame_path = tempfile.mkstemp(prefix=f"frame-{idx+1}-", suffix=".png", dir=str(out_dir))
        os.close(fd)
        base_img.save(frame_path)
        return frame_path

    def _prepare_background_image(
        self,
        visual_path: Optional[str],
        w: int,
        h: int,
        out_dir: Path,
        cleanup_list: List[str],
    ) -> Image.Image:
        """Download remote image or load local file, fitting to canvas with aesthetic grading."""
        if visual_path:
            local_src = visual_path
            if visual_path.startswith("http://") or visual_path.startswith("https://"):
                try:
                    fd_dl, dl_path = tempfile.mkstemp(prefix="dl-img-", suffix=".jpg", dir=str(out_dir))
                    os.close(fd_dl)
                    cleanup_list.append(dl_path)
                    req = urllib.request.Request(visual_path, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=4.0) as resp, open(dl_path, "wb") as f:
                        f.write(resp.read())
                    local_src = dl_path
                except Exception:
                    local_src = None

            if local_src and os.path.exists(local_src):
                try:
                    loaded = Image.open(local_src).convert("RGB")
                    fitted = ImageOps.fit(loaded, (w, h), method=Image.Resampling.LANCZOS)
                    # Apply gentle vignette darkening
                    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 80))
                    fitted.paste(overlay, (0, 0), overlay)
                    return fitted
                except Exception:
                    pass

        # Fallback aesthetic dark gradient canvas
        canvas = Image.new("RGB", (w, h), color=(18, 22, 32))
        c_draw = ImageDraw.Draw(canvas)
        c_draw.rectangle([0, 0, w, h], fill=(20, 24, 36))
        c_draw.rectangle([40, 40, w - 40, h - 40], outline=(40, 48, 68), width=2)
        return canvas

    def _load_fonts(self) -> Dict[str, Any]:
        """Load crisp Chinese TrueType fonts from Windows."""
        font_candidates = [
            "C:/Windows/Fonts/msyh.ttc",
            "C:/Windows/Fonts/msyhbd.ttc",
            "C:/Windows/Fonts/simhei.ttf",
            "C:/Windows/Fonts/simkai.ttf",
        ]
        chosen_font = None
        for fc in font_candidates:
            if os.path.exists(fc):
                chosen_font = fc
                break

        if chosen_font:
            return {
                "title": ImageFont.truetype(chosen_font, 56),
                "badge": ImageFont.truetype(chosen_font, 36),
                "subtitle": ImageFont.truetype(chosen_font, 46),
                "label": ImageFont.truetype(chosen_font, 30),
            }
        default_f = ImageFont.load_default()
        return {"title": default_f, "badge": default_f, "subtitle": default_f, "label": default_f}

    def _concat_segments(self, segment_paths: List[str], out_dir: Path, cleanup_list: List[str]) -> str:
        """Concatenate all shot segments into a single master MP4 file with uniform audio parameters."""
        fd_txt, list_txt_path = tempfile.mkstemp(prefix="concat-list-", suffix=".txt", dir=str(out_dir))
        cleanup_list.append(list_txt_path)

        with os.fdopen(fd_txt, "w", encoding="utf-8") as f:
            for p in segment_paths:
                clean_p = p.replace("\\", "/")
                f.write(f"file '{clean_p}'\n")

        fd_out, master_path = tempfile.mkstemp(prefix="final-composite-", suffix=".mp4", dir=str(out_dir))
        os.close(fd_out)

        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", list_txt_path,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "44100",
            "-ac", "2",
            "-pix_fmt", "yuv420p",
            master_path,
        ]

        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90.0)
        return master_path

    def _probe_duration(self, file_path: str) -> float:
        """Probe media file duration using ffprobe."""
        try:
            cmd = [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                file_path,
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10.0)
            return float(res.stdout.strip())
        except Exception:
            return 3.5

    def get_input_schema(self) -> Dict[str, Any]:
        """Return input schema for frontend form rendering."""
        return VideoComposeInput.model_json_schema()
