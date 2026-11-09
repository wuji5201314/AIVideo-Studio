"""Digital Human Operator: Batch talking avatar, video anchor loop, and neural lip-sync synthesis.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any in domain models
- Clean subprocess with list args (no shell=True)
- File length <= 400 lines, Function length <= 80 lines
- Proportional error envelopes and fallback handling
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field
from PIL import Image, ImageDraw, ImageFont, ImageOps

from packages.studio_engine.heygem_client import HeyGemClient
from packages.studio_engine.models import CostType
from packages.studio_engine.operator_protocol import BaseOperator, CancellationToken
from packages.studio_engine.registry import register_operator
from packages.studio_engine.subtitles import generate_douyin_subtitles


class AvatarInput(BaseModel):
    """Input payload for AvatarOperator supporting video anchors, dynamic portrait, and lip-sync."""

    text: str = Field(default="欢迎体验全新数字人口播工作台，零成本极速出片。", description="Narration script")
    voice_name: str = Field(default="zh-CN-YunxiNeural", description="TTS voice name")
    audio_path: Optional[str] = Field(default=None, description="Optional existing voiceover audio path")
    face_image_path: Optional[str] = Field(default=None, description="Anchor portrait or video URL/path")
    source_kind: str = Field(default="auto", description="auto, video, or portrait")
    avatar_name: str = Field(default="活力小琳", description="Anchor display name")
    avatar_tag: str = Field(default="好物带货 · 热情洋溢", description="Anchor persona tag")
    sub_mode: str = Field(default="fast", description="fast, remake, or lipsync")
    mode: str = Field(default="fullscreen", description="fullscreen or pip")
    aspect_ratio: str = Field(default="9:16", description="9:16, 16:9, or 1:1")
    subtitle_style: str = Field(default="douyin_yellow", description="douyin_yellow, clean_white, or none")
    output_dir: str = Field(default="storage/temp", description="Output directory")


class AvatarOutput(BaseModel):
    """Output payload from AvatarOperator."""

    video_path: str = Field(description="Generated avatar MP4 video path")
    audio_path: str = Field(description="Synthesized or used audio path")
    duration_sec: float = Field(default=4.0)
    mode: str
    sub_mode: str
    content_hash: str
    engine_note: str = Field(default="Dynamic Studio Presenter")


@register_operator
class AvatarOperator(BaseOperator[AvatarInput, AvatarOutput]):
    """Synthesizes high-impact digital human video with rhythm subtitles and camera motion."""

    op_id = "op_digital_human"
    name = "数字人合成算子"
    category = "02-avatar"
    description = "一键生成批量口播数字人、真实视频底板循环与高燃网感字幕成片"
    is_free_local = True
    cost_type = CostType.VIDEO_GEN
    input_dto_cls = AvatarInput

    ASPECT_MAP = {
        "9:16": (1080, 1920),
        "16:9": (1920, 1080),
        "1:1": (1080, 1080),
    }

    async def execute(
        self,
        input_data: AvatarInput,
        config: Dict[str, Any],
        cancel_token: Optional[CancellationToken] = None,
    ) -> AvatarOutput:
        """Synthesize digital human MP4 video with speech audio, subtitles, and motion."""
        if cancel_token:
            cancel_token.throw_if_cancelled()

        out_dir = Path(input_data.output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        cleanup_files: List[str] = []

        try:
            audio_file = await self._ensure_audio(input_data, out_dir)
            duration = self._probe_duration(audio_file)
            if duration <= 0:
                duration = 4.0

            w, h = self.ASPECT_MAP.get(input_data.aspect_ratio, (1080, 1920))
            is_video_source = self._is_video_media(input_data.face_image_path, input_data.source_kind)

            # HeyGem lip-sync path (if available and requested)
            engine_note = "本地电影级动态运镜 + 高燃网感字幕"
            heygem = HeyGemClient()
            if input_data.sub_mode == "lipsync" and is_video_source and heygem.is_available():
                task_code = heygem.submit_lipsync_task(
                    Path(audio_file),
                    Path(input_data.face_image_path or ""),
                    out_dir,
                )
                if task_code:
                    result_mp4 = heygem.poll_lipsync_task(task_code, timeout_sec=120.0)
                    if result_mp4 and os.path.exists(result_mp4):
                        out_final = self._burn_subtitles_and_badge(
                            result_mp4, input_data, duration, w, h, out_dir, cleanup_files
                        )
                        return AvatarOutput(
                            video_path=out_final,
                            audio_path=audio_file,
                            duration_sec=round(duration, 2),
                            mode=input_data.mode,
                            sub_mode=input_data.sub_mode,
                            content_hash=self._calc_hash(input_data),
                            engine_note="HeyGem 旗博士神经网络对口型成片",
                        )

            # High-impact presentation synthesis
            if is_video_source and input_data.face_image_path and os.path.exists(input_data.face_image_path):
                out_final = self._render_video_anchor(
                    input_data.face_image_path, audio_file, input_data, duration, w, h, out_dir, cleanup_files
                )
                engine_note = "真人视频底板自然微动态 + 高燃节奏字幕"
            else:
                out_final = self._render_portrait_presenter(
                    audio_file, input_data, duration, w, h, out_dir, cleanup_files
                )

            return AvatarOutput(
                video_path=out_final,
                audio_path=audio_file,
                duration_sec=round(duration, 2),
                mode=input_data.mode,
                sub_mode=input_data.sub_mode,
                content_hash=self._calc_hash(input_data),
                engine_note=engine_note,
            )
        finally:
            for fpath in cleanup_files:
                if os.path.exists(fpath):
                    try:
                        os.remove(fpath)
                    except OSError:
                        pass

    def _is_video_media(self, path_str: Optional[str], source_kind: str) -> bool:
        """Determine whether the anchor source is a motion video or static portrait."""
        if source_kind == "video":
            return True
        if not path_str:
            return False
        ext = Path(path_str).suffix.lower()
        return ext in (".mp4", ".mov", ".webm", ".mkv", ".m4v")

    async def _ensure_audio(self, input_data: AvatarInput, out_dir: Path) -> str:
        """Use existing audio file or synthesize speech via edge-tts."""
        if input_data.audio_path and os.path.exists(input_data.audio_path) and os.path.getsize(input_data.audio_path) > 256:
            return input_data.audio_path

        fd, tts_path = tempfile.mkstemp(prefix="avatar-tts-", suffix=".mp3", dir=str(out_dir))
        os.close(fd)

        narration = input_data.text.strip() or "欢迎体验全新数字人口播工作台。"
        try:
            import edge_tts

            comm = edge_tts.Communicate(text=narration, voice=input_data.voice_name)
            await comm.save(tts_path)
            if os.path.exists(tts_path) and os.path.getsize(tts_path) > 256:
                return tts_path
        except Exception:
            pass

        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
            "-t", "4.0",
            "-c:a", "libmp3lame", "-b:a", "128k",
            tts_path,
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15.0)
        return tts_path

    def _render_portrait_presenter(
        self,
        audio_file: str,
        input_data: AvatarInput,
        duration: float,
        w: int,
        h: int,
        out_dir: Path,
        cleanup: List[str],
    ) -> str:
        """Render portrait with breathing camera zoom push-in, top pill badge, and rhythm subtitles."""
        bg_frame = self._render_clean_canvas(input_data, w, h, out_dir, cleanup)
        cleanup.append(bg_frame)

        # Generate rhythm subtitles
        ass_path = out_dir / f"sub-{os.path.basename(bg_frame)}.ass"
        generate_douyin_subtitles(
            text=input_data.text,
            total_duration=duration,
            output_ass=ass_path,
            style_theme=input_data.subtitle_style,
            video_width=w,
            video_height=h,
        )
        cleanup.append(str(ass_path))

        fd, out_mp4 = tempfile.mkstemp(prefix="avatar-dyn-", suffix=".mp4", dir=str(out_dir))
        os.close(fd)

        # Subtle Ken Burns push-in zoompan + rhythmic ASS subtitles
        zoom_expr = "min(zoom+0.0006,1.06)"
        vf_filter = (
            f"zoompan=z='{zoom_expr}':d={int(duration * 30)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            f"s={w}x{h}:fps=30,subtitles={ass_path.name}"
        )

        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", os.path.basename(bg_frame),
            "-i", audio_file,
            "-vf", vf_filter,
            "-t", str(duration),
            "-c:v", "libx264", "-preset", "fast", "-crf", "22",
            "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            out_mp4,
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=str(out_dir), timeout=90.0)
        return out_mp4

    def _render_video_anchor(
        self,
        video_anchor: str,
        audio_file: str,
        input_data: AvatarInput,
        duration: float,
        w: int,
        h: int,
        out_dir: Path,
        cleanup: List[str],
    ) -> str:
        """Loop reference video anchor naturally and burn rhythm subtitles with top badge."""
        badge_png = self._render_top_badge(input_data, w, out_dir, cleanup)
        cleanup.append(badge_png)

        ass_path = out_dir / f"sub-anchor-{os.path.basename(badge_png)}.ass"
        generate_douyin_subtitles(
            text=input_data.text,
            total_duration=duration,
            output_ass=ass_path,
            style_theme=input_data.subtitle_style,
            video_width=w,
            video_height=h,
        )
        cleanup.append(str(ass_path))

        fd, out_mp4 = tempfile.mkstemp(prefix="avatar-anchor-", suffix=".mp4", dir=str(out_dir))
        os.close(fd)

        filter_complex = (
            f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}[base];"
            f"[base][1:v]overlay=x=(W-w)/2:y=60[with_badge];"
            f"[with_badge]subtitles={ass_path.name}[outv]"
        )

        cmd = [
            "ffmpeg", "-y",
            "-stream_loop", "-1", "-i", video_anchor,
            "-i", os.path.basename(badge_png),
            "-i", audio_file,
            "-filter_complex", filter_complex,
            "-map", "[outv]", "-map", "2:a",
            "-t", str(duration),
            "-c:v", "libx264", "-preset", "fast", "-crf", "22",
            "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            out_mp4,
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=str(out_dir), timeout=90.0)
        return out_mp4

    def _render_clean_canvas(
        self,
        input_data: AvatarInput,
        w: int,
        h: int,
        out_dir: Path,
        cleanup: List[str],
    ) -> str:
        """Render studio portrait canvas without obscuring black cards."""
        canvas = Image.new("RGB", (w, h), color=(18, 22, 34))
        portrait = self._load_portrait(input_data.face_image_path, w, h, out_dir, cleanup)
        if portrait is not None:
            fitted = ImageOps.fit(portrait, (w, h), method=Image.Resampling.LANCZOS)
            canvas = fitted

        draw = ImageDraw.Draw(canvas, "RGBA")
        fonts = self._load_fonts()

        # Top anchor badge pill
        badge_text = f"主播: {input_data.avatar_name} · {input_data.avatar_tag}"
        badge_w = min(w - 100, max(460, len(badge_text) * 26 + 60))
        bx1 = (w - badge_w) // 2
        bx2 = bx1 + badge_w
        draw.rounded_rectangle([bx1, 70, bx2, 140], radius=24, fill=(15, 23, 42, 190), outline=(56, 189, 248, 220), width=2)
        draw.text((bx1 + 28, 86), badge_text, font=fonts["badge"], fill=(255, 255, 255, 255))

        fd, frame_path = tempfile.mkstemp(prefix="avatar-base-", suffix=".png", dir=str(out_dir))
        os.close(fd)
        canvas.save(frame_path)
        return frame_path

    def _render_top_badge(
        self,
        input_data: AvatarInput,
        w: int,
        out_dir: Path,
        cleanup: List[str],
    ) -> str:
        """Render standalone transparent top badge pill for video overlays."""
        badge_text = f"主播: {input_data.avatar_name} · {input_data.avatar_tag}"
        badge_w = min(w - 100, max(460, len(badge_text) * 26 + 60))
        img = Image.new("RGBA", (badge_w, 80), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        fonts = self._load_fonts()

        draw.rounded_rectangle([0, 0, badge_w, 76], radius=24, fill=(15, 23, 42, 195), outline=(56, 189, 248, 220), width=2)
        draw.text((28, 16), badge_text, font=fonts["badge"], fill=(255, 255, 255, 255))

        fd, p = tempfile.mkstemp(prefix="badge-", suffix=".png", dir=str(out_dir))
        os.close(fd)
        img.save(p)
        return p

    def _load_portrait(
        self,
        src: Optional[str],
        w: int,
        h: int,
        out_dir: Path,
        cleanup: List[str],
    ) -> Optional[Image.Image]:
        """Safely load local or remote portrait image."""
        if not src:
            return self._generate_fallback_anchor(w, h)

        local_path = src
        if src.startswith("http://") or src.startswith("https://"):
            fd, tmp = tempfile.mkstemp(prefix="face-dl-", suffix=".jpg", dir=str(out_dir))
            os.close(fd)
            cleanup.append(tmp)
            try:
                urllib.request.urlretrieve(src, tmp)
                local_path = tmp
            except Exception:
                return self._generate_fallback_anchor(w, h)

        if not os.path.exists(local_path):
            return self._generate_fallback_anchor(w, h)

        try:
            return Image.open(local_path).convert("RGB")
        except Exception:
            return self._generate_fallback_anchor(w, h)

    def _generate_fallback_anchor(self, w: int, h: int) -> Image.Image:
        """Generate sleek gradient anchor portrait when no custom media is supplied."""
        img = Image.new("RGB", (w, h), color=(24, 30, 48))
        draw = ImageDraw.Draw(img)
        draw.ellipse([w // 2 - 280, h // 2 - 450, w // 2 + 280, h // 2 + 110], fill=(225, 185, 155))
        draw.ellipse([w // 2 - 340, h // 2 - 600, w // 2 + 340, h // 2 - 200], fill=(45, 55, 75))
        draw.rounded_rectangle([w // 2 - 400, h // 2 + 120, w // 2 + 400, h], radius=60, fill=(35, 45, 70))
        return img

    def _load_fonts(self) -> Dict[str, ImageFont.ImageFont]:
        """Load Chinese system fonts gracefully with fallbacks."""
        font_candidates = [
            "C:/Windows/Fonts/msyh.ttc",
            "C:/Windows/Fonts/simhei.ttf",
            "C:/Windows/Fonts/simsun.ttc",
        ]
        for fpath in font_candidates:
            if os.path.exists(fpath):
                try:
                    return {
                        "badge": ImageFont.truetype(fpath, 30),
                        "sub": ImageFont.truetype(fpath, 38),
                        "label": ImageFont.truetype(fpath, 28),
                    }
                except Exception:
                    continue
        default = ImageFont.load_default()
        return {"badge": default, "sub": default, "label": default}

    def _probe_duration(self, audio_path: str) -> float:
        """Probe audio file duration in seconds."""
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path,
        ]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10.0)
            if res.returncode == 0 and res.stdout.strip():
                return float(res.stdout.strip())
        except Exception:
            pass
        return 4.0

    def _calc_hash(self, input_data: AvatarInput) -> str:
        """Calculate determinism hash for the avatar synthesis input."""
        raw = f"{input_data.text}|{input_data.voice_name}|{input_data.avatar_name}|{input_data.aspect_ratio}|{input_data.sub_mode}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()
