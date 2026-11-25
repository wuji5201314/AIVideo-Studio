"""Lightweight local character replacement backend for low-spec PCs (CPU / 2GB VRAM).

Supports:
1. Open-source InsightFace (inswapper_128.onnx) frame-by-frame face swap when installed,
   preserving 100% of the original video scene, clothing, and gestures on CPU/low-VRAM.
2. Zero-dependency FFmpeg scene-preserved presenter composition fallback when ONNX weights
   are not yet installed, keeping the original video scene intact.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- File <= 300 lines, Function <= 80 lines
- No shell=True
"""

from __future__ import annotations

import os
import subprocess
import uuid
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageOps

from packages.studio_engine.wan_animate.base import (
    BackendHealth,
    BaseWanAnimateBackend,
    ProgressCallback,
    WanAnimateRequest,
    WanAnimateResult,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
INSWAPPER_CANDIDATES = [
    REPO_ROOT / "storage" / "models" / "inswapper_128.onnx",
    Path.home() / ".insightface" / "models" / "inswapper_128.onnx",
]


class LightweightLocalSwapBackend(BaseWanAnimateBackend):
    """Low-compute open-source character replacement for laptops without 24GB GPUs."""

    backend_id = "local_fallback"
    label = "本机低配开源引擎 (场景保留 · 免大显存)"

    def _find_inswapper_model(self) -> Optional[Path]:
        for p in INSWAPPER_CANDIDATES:
            if p.is_file() and p.stat().st_size > 10_000_000:
                return p
        return None

    def _has_insightface_runtime(self) -> bool:
        try:
            import cv2  # noqa: F401
            import insightface  # noqa: F401
            import onnxruntime  # noqa: F401
            return self._find_inswapper_model() is not None
        except Exception:
            return False

    def check_health(self, timeout: float = 2.0) -> BackendHealth:
        """Report whether InsightFace ONNX swap or FFmpeg scene-preserved mode is active."""
        if self._has_insightface_runtime():
            return BackendHealth(
                backend_id=self.backend_id,
                label="本机低配开源换脸 (InsightFace ONNX · CPU/2G显存可用)",
                available=True,
                endpoint="local://insightface",
                detail="已检测到 inswapper_128.onnx，支持保留原片场景逐帧换脸",
            )
        return BackendHealth(
            backend_id=self.backend_id,
            label=self.label,
            available=True,
            endpoint="local://ffmpeg-scene",
            detail="离线可用：保留原片实景画面 + 目标人物融合（配置 DashScope Key 或 ComfyUI 可升级 Wan2.2-Animate 全身替换）",
        )

    def generate(
        self,
        req: WanAnimateRequest,
        on_progress: Optional[ProgressCallback] = None,
    ) -> WanAnimateResult:
        """Run InsightFace swap if installed, else run FFmpeg scene-preserved replacement."""
        out_dir = Path(req.output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

        if self._has_insightface_runtime():
            return self._run_insightface_swap(req, out_dir, on_progress)
        return self._run_ffmpeg_scene_compose(req, out_dir, on_progress)

    def _run_insightface_swap(
        self,
        req: WanAnimateRequest,
        out_dir: Path,
        on_progress: Optional[ProgressCallback],
    ) -> WanAnimateResult:
        """Frame-by-frame face replacement with InsightFace while keeping 100% original scene."""
        import cv2
        import insightface
        from insightface.app import FaceAnalysis

        self._emit(on_progress, 0.20, "preprocess", "正在加载本机轻量开源 InsightFace 模型...")
        app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=-1, det_size=(640, 640))

        model_path = self._find_inswapper_model()
        swapper = insightface.model_zoo.get_model(str(model_path), providers=["CPUExecutionProvider"])

        src_img = cv2.imread(req.character_image_path)
        src_faces = app.get(src_img)
        if not src_faces:
            return self._run_ffmpeg_scene_compose(req, out_dir, on_progress)
        source_face = src_faces[0]

        cap = cv2.VideoCapture(req.video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total = max(1, int(cap.get(cv2.CAP_PROP_FRAME_COUNT)))

        raw_avi = out_dir / f"swap-raw-{uuid.uuid4().hex[:8]}.mp4"
        writer = cv2.VideoWriter(str(raw_avi), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

        idx = 0
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                faces = app.get(frame)
                for face in faces:
                    frame = swapper.get(frame, face, source_face, paste_back=True)
                writer.write(frame)
                idx += 1
                if idx % 10 == 0:
                    pct = 0.25 + min(0.55, (idx / total) * 0.55)
                    self._emit(on_progress, pct, "wan_animate", f"本机开源换脸逐帧渲染中 ({idx}/{total})...")
        finally:
            cap.release()
            writer.release()

        out_mp4 = out_dir / f"swap-web-{uuid.uuid4().hex[:8]}.mp4"
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(raw_avi),
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out_mp4),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120.0,
            check=True,
        )
        if raw_avi.exists():
            raw_avi.unlink(missing_ok=True)

        return WanAnimateResult(
            video_path=str(out_mp4),
            backend_id=self.backend_id,
            backend_label="本机开源 InsightFace 逐帧换脸 (场景100%保留)",
            mode=req.mode,
            is_neural_wan=False,
            note="本机轻量开源 InsightFace 完成逐帧人物面部替换，原片场景与动作完整保留",
        )

    def _run_ffmpeg_scene_compose(
        self,
        req: WanAnimateRequest,
        out_dir: Path,
        on_progress: Optional[ProgressCallback],
    ) -> WanAnimateResult:
        """Preserve original parsed video scene and composite target character card cleanly."""
        self._emit(on_progress, 0.35, "preprocess", "正在准备原片实景背景与目标人物卡片...")
        card_png = out_dir / f"char-card-{uuid.uuid4().hex[:8]}.png"
        self._build_character_card(Path(req.character_image_path), card_png)

        out_mp4 = out_dir / f"scene-replace-{uuid.uuid4().hex[:8]}.mp4"
        w, h = (720, 1280) if req.resolution == "720p" else (480, 854)

        self._emit(on_progress, 0.60, "wan_animate", "正在基于原视频实景融合目标人物形象（本机轻量模式）...")
        if req.mode == "replace":
            # Keep 100% of original video scene; composite target character cleanly in lower-right broadcast frame
            filter_complex = (
                f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}[bg];"
                f"[1:v]scale={int(w * 0.34)}:-1[fg];"
                f"[bg][fg]overlay=x=W-w-28:y=H-h-220[outv]"
            )
            cmd = [
                "ffmpeg", "-y",
                "-i", req.video_path,
                "-i", str(card_png),
                "-filter_complex", filter_complex,
                "-map", "[outv]",
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-pix_fmt", "yuv420p", "-an",
                "-movflags", "+faststart",
                str(out_mp4),
            ]
        else:
            # Move mode fallback: dynamic push-in on target portrait
            cmd = [
                "ffmpeg", "-y",
                "-loop", "1", "-i", req.character_image_path,
                "-t", "6",
                "-vf", (
                    f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
                    f"zoompan=z='min(zoom+0.0006,1.06)':d=180:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps=30"
                ),
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-pix_fmt", "yuv420p", "-an",
                "-movflags", "+faststart",
                str(out_mp4),
            ]

        try:
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120.0, check=True)
        finally:
            if card_png.exists():
                card_png.unlink(missing_ok=True)

        return WanAnimateResult(
            video_path=str(out_mp4),
            backend_id=self.backend_id,
            backend_label="本机轻量开源兜底 (原片实景保留 + 人物融合)",
            mode=req.mode,
            is_neural_wan=False,
            note="已保留原片实景画面并融合目标人物（配置 DashScope Key 或开源 ComfyUI 可启用 Wan2.2-Animate 神经网络全身替换）",
        )

    @staticmethod
    def _build_character_card(image_path: Path, dest_png: Path) -> None:
        """Create a rounded RGBA portrait card with subtle border for scene composition."""
        size = (360, 460)
        img = Image.open(image_path).convert("RGBA")
        fitted = ImageOps.fit(img, size, method=Image.Resampling.LANCZOS)

        mask = Image.new("L", size, 0)
        draw = ImageDraw.Draw(mask)
        draw.rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=32, fill=255)

        card = Image.new("RGBA", size, (0, 0, 0, 0))
        card.paste(fitted, (0, 0), mask)
        border = ImageDraw.Draw(card)
        border.rounded_rectangle([2, 2, size[0] - 3, size[1] - 3], radius=32, outline=(255, 255, 255, 220), width=4)
        card.save(dest_png)

    @staticmethod
    def _emit(cb: Optional[ProgressCallback], progress: float, stage: str, msg: str) -> None:
        if cb:
            cb(progress, stage, msg)
