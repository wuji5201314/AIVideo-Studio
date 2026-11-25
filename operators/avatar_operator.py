"""Digital Human Operator powered by Wan2.2-Animate multi-backend architecture.

Supports:
- Character Replacement (replace): keep original video scene & lighting, swap character
- Motion Transfer (move): animate target portrait using driving video motion
- Multi-backend routing: open-source ComfyUI, official Wan2.2 GPU Worker, DashScope API,
  and low-spec local open-source fallback (InsightFace ONNX / FFmpeg scene preservation)
- Audio handling: keep original audio, Edge-TTS replacement, or custom audio
- Douyin rhythmic ASS subtitles + H.264/AAC faststart muxing

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any in domain models
- Clean subprocess with list args (no shell=True)
- File length <= 400 lines, Function length <= 80 lines
"""

from __future__ import annotations

import hashlib
import os
import subprocess
import tempfile
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from PIL import Image, ImageDraw

from packages.studio_engine.models import CostType
from packages.studio_engine.operator_protocol import BaseOperator, CancellationToken
from packages.studio_engine.registry import register_operator
from packages.studio_engine.subtitles import generate_douyin_subtitles
from packages.studio_engine.wan_animate import (
    ProgressCallback,
    WanAnimateRequest,
    WanAnimateRouter,
)

REPO_ROOT = Path(__file__).resolve().parents[1]


class AvatarInput(BaseModel):
    """Input payload for Wan2.2-Animate digital human replacement & talking video synthesis."""

    text: str = Field(default="欢迎体验新一代开源数字人口播工作台。", description="Narration script for TTS & subtitles")
    voice_name: str = Field(default="zh-CN-XiaoxiaoNeural", description="Edge-TTS voice name")
    audio_mode: Literal["tts_replace", "keep_original", "custom_audio"] = Field(
        default="tts_replace",
        description="tts_replace: synthesize new voice; keep_original: keep driving video audio; custom_audio: use audio_path",
    )
    audio_path: Optional[str] = Field(default=None, description="Optional custom audio path")
    driving_video_path: Optional[str] = Field(default=None, description="Source/benchmark video path (for scene & motion)")
    face_image_path: Optional[str] = Field(default=None, description="Target character portrait path or URL")
    animate_mode: Literal["replace", "move"] = Field(default="replace", description="Wan2.2-Animate replace or move")
    backend_preference: str = Field(default="auto", description="auto | comfyui | wan_worker | dashscope | local_fallback")
    resolution: Literal["480p", "720p"] = Field(default="720p")
    use_relighting_lora: bool = Field(default=True, description="Relighting LoRA for scene lighting harmony")
    avatar_name: str = Field(default="活力小琳", description="Anchor display name")
    avatar_tag: str = Field(default="实景口播 · 人物替换", description="Anchor persona tag")
    sub_mode: str = Field(default="replace", description="replace | move | fast | lipsync")
    mode: str = Field(default="fullscreen", description="fullscreen or pip")
    aspect_ratio: str = Field(default="9:16", description="9:16, 16:9, or 1:1")
    subtitle_style: str = Field(default="douyin_yellow", description="douyin_yellow, clean_white, or none")
    output_dir: str = Field(default="storage/temp", description="Output directory")


class AvatarOutput(BaseModel):
    """Output payload from AvatarOperator."""

    video_path: str = Field(description="Final rendered MP4 video path")
    audio_path: str = Field(description="Final audio track path")
    duration_sec: float = Field(default=4.0)
    mode: str
    sub_mode: str
    backend_id: str = Field(default="local_fallback")
    is_neural_wan: bool = Field(default=False)
    content_hash: str
    engine_note: str = Field(default="")


@register_operator
class AvatarOperator(BaseOperator[AvatarInput, AvatarOutput]):
    """Synthesizes digital human talking videos using Wan2.2-Animate or low-spec open-source fallback."""

    op_id = "op_digital_human"
    name = "Wan2.2-Animate 数字人算子"
    category = "02-avatar"
    description = "基于开源 Wan2.2-Animate 的视频人物替换（场景不变）与数字人口播合成"
    is_free_local = True
    cost_type = CostType.VIDEO_GEN
    input_dto_cls = AvatarInput

    async def execute(
        self,
        input_data: AvatarInput,
        config: Dict[str, Any],
        cancel_token: Optional[CancellationToken] = None,
    ) -> AvatarOutput:
        """Orchestrate character replacement/animation, audio replacement, and subtitle burn."""
        on_progress: Optional[ProgressCallback] = config.get("on_progress")
        if cancel_token:
            cancel_token.throw_if_cancelled()

        base = Path(input_data.output_dir)
        out_dir = (REPO_ROOT / base).resolve() if not base.is_absolute() else base.resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        cleanup_files: List[str] = []

        try:
            self._emit(on_progress, 0.08, "preprocess", "正在校验人物肖像与驱动视频素材...")
            char_img = self._resolve_character_image(input_data.face_image_path, out_dir, cleanup_files)
            audio_file = await self._prepare_audio(input_data, out_dir, cleanup_files)
            audio_dur = self._probe_duration(audio_file)

            has_driving = bool(input_data.driving_video_path and os.path.isfile(input_data.driving_video_path))
            driving_video = (
                str(Path(input_data.driving_video_path).resolve())
                if has_driving
                else self._create_driving_stub(char_img, audio_dur, out_dir, cleanup_files)
            )

            wan_req = WanAnimateRequest(
                mode=input_data.animate_mode if has_driving else "move",
                video_path=driving_video,
                character_image_path=char_img,
                output_dir=str(out_dir),
                resolution=input_data.resolution,
                use_relighting_lora=input_data.use_relighting_lora,
            )

            router = WanAnimateRouter()
            wan_res = router.generate(
                wan_req,
                preferred_backend=input_data.backend_preference,
                on_progress=on_progress,
            )
            cleanup_files.append(wan_res.video_path)

            self._emit(on_progress, 0.88, "postprocess", "正在合成口播音轨、抖音高燃节奏字幕与 H.264 封装...")
            final_mp4 = self._mux_audio_and_subtitles(
                video_path=wan_res.video_path,
                audio_path=audio_file,
                input_data=input_data,
                duration=audio_dur,
                out_dir=out_dir,
                cleanup=cleanup_files,
            )
            final_dur = self._probe_duration(final_mp4) or audio_dur
            self._emit(on_progress, 1.0, "done", "数字人口播成片渲染完成！")

            return AvatarOutput(
                video_path=final_mp4,
                audio_path=audio_file,
                duration_sec=round(final_dur, 2),
                mode=input_data.animate_mode,
                sub_mode=input_data.sub_mode,
                backend_id=wan_res.backend_id,
                is_neural_wan=wan_res.is_neural_wan,
                content_hash=self._calc_hash(input_data),
                engine_note=wan_res.note or wan_res.backend_label,
            )
        finally:
            for fpath in cleanup_files:
                if fpath and os.path.exists(fpath):
                    try:
                        os.remove(fpath)
                    except OSError:
                        pass

    def _resolve_character_image(self, src: Optional[str], out_dir: Path, cleanup: List[str]) -> str:
        """Download remote portrait URL or generate clean local PNG fallback."""
        if src and os.path.isfile(src):
            return str(Path(src).resolve())
        if src and src.startswith(("http://", "https://")):
            tmp = out_dir / f"char-dl-{uuid.uuid4().hex[:8]}.jpg"
            try:
                urllib.request.urlretrieve(src, str(tmp))
                if tmp.exists() and tmp.stat().st_size > 1000:
                    cleanup.append(str(tmp))
                    return str(tmp)
            except Exception:
                pass

        fallback = out_dir / f"char-fallback-{uuid.uuid4().hex[:8]}.png"
        img = Image.new("RGB", (720, 1280), color=(28, 36, 54))
        draw = ImageDraw.Draw(img)
        draw.ellipse([210, 260, 510, 560], fill=(225, 190, 165))
        draw.rounded_rectangle([140, 580, 580, 1280], radius=60, fill=(45, 58, 86))
        img.save(fallback)
        cleanup.append(str(fallback))
        return str(fallback)

    def _create_driving_stub(self, char_img: str, duration: float, out_dir: Path, cleanup: List[str]) -> str:
        """Generate a clean motion stub video when user only supplies a portrait (Batch mode)."""
        stub = out_dir / f"stub-{uuid.uuid4().hex[:8]}.mp4"
        cmd = [
            "ffmpeg", "-y", "-loop", "1", "-i", char_img,
            "-t", f"{max(2.0, duration):.2f}",
            "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-an",
            str(stub),
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30.0)
        cleanup.append(str(stub))
        return str(stub)

    async def _prepare_audio(self, input_data: AvatarInput, out_dir: Path, cleanup: List[str]) -> str:
        """Resolve audio track according to audio_mode (keep_original | custom_audio | tts_replace)."""
        if input_data.audio_mode == "custom_audio" and input_data.audio_path and os.path.isfile(input_data.audio_path):
            return str(Path(input_data.audio_path).resolve())

        if input_data.audio_mode == "keep_original" and input_data.driving_video_path and os.path.isfile(input_data.driving_video_path):
            extracted = out_dir / f"orig-audio-{uuid.uuid4().hex[:8]}.m4a"
            res = subprocess.run(
                ["ffmpeg", "-y", "-i", input_data.driving_video_path, "-vn", "-c:a", "aac", "-b:a", "192k", str(extracted)],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30.0,
            )
            if res.returncode == 0 and extracted.exists() and extracted.stat().st_size > 512:
                return str(extracted)

        tts_path = str(out_dir / f"avatar-tts-{uuid.uuid4().hex[:8]}.mp3")
        narration = input_data.text.strip() or "欢迎体验全新开源数字人口播工作台。"
        try:
            import edge_tts

            comm = edge_tts.Communicate(text=narration, voice=input_data.voice_name)
            await comm.save(tts_path)
            if os.path.exists(tts_path) and os.path.getsize(tts_path) > 256:
                return tts_path
        except Exception:
            pass

        subprocess.run(
            ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "5.0", "-c:a", "libmp3lame", tts_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15.0,
        )
        return tts_path

    def _mux_audio_and_subtitles(
        self,
        video_path: str,
        audio_path: str,
        input_data: AvatarInput,
        duration: float,
        out_dir: Path,
        cleanup: List[str],
    ) -> str:
        """Loop/trim generated video to match audio, burn optional Douyin ASS subtitles, encode H.264."""
        out_mp4 = str(out_dir / f"avatar-final-{uuid.uuid4().hex[:8]}.mp4")
        w, h = self._probe_video_size(video_path)

        vf_parts: List[str] = []
        if input_data.subtitle_style != "none" and input_data.text.strip():
            ass_file = out_dir / f"sub-{uuid.uuid4().hex[:8]}.ass"
            generate_douyin_subtitles(
                text=input_data.text,
                total_duration=max(duration, 2.0),
                output_ass=ass_file,
                style_theme=input_data.subtitle_style,
                video_width=w,
                video_height=h,
            )
            cleanup.append(str(ass_file))
            vf_parts.append(f"subtitles={ass_file.name}")

        cmd = [
            "ffmpeg", "-y",
            "-stream_loop", "-1", "-i", video_path,
            "-i", audio_path,
        ]
        if vf_parts:
            cmd += ["-vf", ",".join(vf_parts)]
        cmd += [
            "-map", "0:v:0", "-map", "1:a:0",
            "-t", f"{max(duration, 1.5):.2f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "21",
            "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            out_mp4,
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=str(out_dir), timeout=120.0, check=True)
        return out_mp4

    def _probe_duration(self, media_path: str) -> float:
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            media_path,
        ]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10.0)
            if res.returncode == 0 and res.stdout.strip():
                return float(res.stdout.strip())
        except Exception:
            pass
        return 5.0

    def _probe_video_size(self, video_path: str) -> tuple[int, int]:
        cmd = [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=s=x:p=0", video_path,
        ]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10.0)
            if res.returncode == 0 and "x" in res.stdout:
                w_s, h_s = res.stdout.strip().split("x", 1)
                return max(320, int(w_s)), max(320, int(h_s))
        except Exception:
            pass
        return 720, 1280

    @staticmethod
    def _calc_hash(input_data: AvatarInput) -> str:
        raw = f"{input_data.text}|{input_data.driving_video_path}|{input_data.face_image_path}|{input_data.animate_mode}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def _emit(cb: Optional[ProgressCallback], progress: float, stage: str, msg: str) -> None:
        if cb:
            cb(progress, stage, msg)
