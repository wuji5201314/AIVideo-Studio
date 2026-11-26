"""JianYing Pro (剪映) Draft Exporter powered by open-source pyJianYingDraft.

Generates genuine multi-track JianYing Pro project folders (Video + Audio + Timed
Douyin-style Subtitles) directly into the local JianYing drafts directory and
produces a portable ZIP archive for backup/sharing.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- File <= 260 lines, Function <= 80 lines
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import uuid
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from packages.studio_engine.settings_store import SettingsStore

REPO_ROOT = Path(__file__).resolve().parents[2]
LOCAL_DRAFTS_FALLBACK = REPO_ROOT / "storage" / "jianying_drafts"


class DraftShotSpec(BaseModel):
    """Single timeline segment for JianYing draft export."""

    headline: str = Field(default="")
    narration: str = Field(default="")
    visual_path: Optional[str] = Field(default=None)
    audio_path: Optional[str] = Field(default=None)
    duration_sec: float = Field(default=4.0, gt=0.2)


class JianYingExportRequest(BaseModel):
    """Request payload for exporting a multi-track JianYing Pro draft."""

    project_name: str = Field(default="AIVideo_Studio_草稿")
    aspect_ratio: str = Field(default="9:16")
    fps: int = Field(default=30)
    shots: List[DraftShotSpec] = Field(default_factory=list)
    write_to_jianying_dir: bool = Field(default=True)


class JianYingExportResult(BaseModel):
    """Result metadata after exporting a JianYing Pro draft."""

    draft_name: str
    draft_dir: str
    zip_path: str
    written_to_jianying: bool
    total_duration_sec: float
    track_summary: str


def detect_jianying_drafts_dir() -> Optional[Path]:
    """Auto-detect local Windows JianYing Pro drafts root directory."""
    settings = SettingsStore().get_cloud_api_settings()
    if settings.jianying_drafts_dir and Path(settings.jianying_drafts_dir).is_dir():
        return Path(settings.jianying_drafts_dir).resolve()

    local_app = os.environ.get("LOCALAPPDATA", "")
    candidates = [
        Path(local_app) / "JianyingPro" / "User Data" / "Projects" / "com.lveditor.draft",
        Path.home() / "AppData" / "Local" / "JianyingPro" / "User Data" / "Projects" / "com.lveditor.draft",
    ]
    for cand in candidates:
        if cand.is_dir():
            return cand.resolve()
    return None


class JianYingDraftExporter:
    """Exports multi-track video/audio/subtitle timelines into JianYing Pro drafts."""

    def export(self, req: JianYingExportRequest) -> JianYingExportResult:
        """Assemble JianYing draft via pyJianYingDraft and package portable ZIP."""
        import pyJianYingDraft as draft
        from pyJianYingDraft import ClipSettings, TextBorder, TextStyle, TrackSpec, TrackType, trange

        if not req.shots:
            raise ValueError("至少需要 1 个镜头或视频片段才能导出剪映草稿")

        detected_dir = detect_jianying_drafts_dir()
        use_jy = bool(req.write_to_jianying_dir and detected_dir)
        root_dir = detected_dir if use_jy else LOCAL_DRAFTS_FALLBACK
        root_dir.mkdir(parents=True, exist_ok=True)

        safe_title = re.sub(r'[\\/:*?"<>|\s]+', "_", req.project_name.strip() or "AIVideo草稿")[:28]
        draft_name = f"{safe_title}_{uuid.uuid4().hex[:6]}"

        width, height = (1080, 1920) if req.aspect_ratio == "9:16" else (1920, 1080)
        folder = draft.DraftFolder(str(root_dir))
        script = folder.create_draft(draft_name, width, height, allow_replace=True)

        v_track = script.append_track(TrackSpec(TrackType.video, "主视频轨"))
        a_track = script.append_track(TrackSpec(TrackType.audio, "口播配音轨"))
        t_track = script.append_track(TrackSpec(TrackType.text, "抖音网感字幕轨"))

        draft_path = (root_dir / draft_name).resolve()
        assets_dir = draft_path / "studio_assets"
        assets_dir.mkdir(parents=True, exist_ok=True)

        cursor_sec = 0.0
        video_count = 0
        audio_count = 0
        text_count = 0

        for idx, shot in enumerate(req.shots):
            dur = max(1.0, float(shot.duration_sec or 4.0))

            # Probe real audio duration if audio file exists
            staged_audio = self._stage_media(shot.audio_path, assets_dir, f"audio_{idx + 1}")
            if staged_audio:
                probed = self._probe_duration(str(staged_audio))
                if probed > 0.5:
                    dur = probed

            # 1. Add video / image segment
            staged_visual = self._stage_media(shot.visual_path, assets_dir, f"visual_{idx + 1}")
            if staged_visual:
                try:
                    v_seg = draft.VideoSegment(str(staged_visual), trange(f"{cursor_sec:.2f}s", f"{dur:.2f}s"))
                    script.add_segment(v_seg, v_track)
                    video_count += 1
                except Exception:
                    pass

            # 2. Add voiceover audio segment
            if staged_audio:
                try:
                    a_seg = draft.AudioSegment(str(staged_audio), trange(f"{cursor_sec:.2f}s", f"{dur:.2f}s"))
                    script.add_segment(a_seg, a_track)
                    audio_count += 1
                except Exception:
                    pass

            # 3. Add rhythmic Chinese subtitle text segment(s)
            narration = (shot.narration or shot.headline or "").strip()
            if narration:
                cues = self._split_cues(narration)
                cue_dur = dur / max(1, len(cues))
                for c_idx, cue in enumerate(cues):
                    c_start = cursor_sec + c_idx * cue_dur
                    try:
                        t_seg = draft.TextSegment(
                            cue,
                            trange(f"{c_start:.2f}s", f"{max(0.4, cue_dur):.2f}s"),
                            style=TextStyle(size=8.0, color=(1.0, 0.92, 0.15), bold=True),
                            clip_settings=ClipSettings(transform_y=-0.72),
                            border=TextBorder(alpha=1.0, color=(0.0, 0.0, 0.0), width=40.0),
                        )
                        script.add_segment(t_seg, t_track)
                        text_count += 1
                    except Exception:
                        pass

            cursor_sec += dur

        script.save()
        zip_path = self._zip_draft_folder(draft_path, draft_name)

        return JianYingExportResult(
            draft_name=draft_name,
            draft_dir=str(draft_path),
            zip_path=str(zip_path),
            written_to_jianying=use_jy,
            total_duration_sec=round(cursor_sec, 2),
            track_summary=f"视频片段 {video_count} 段 · 音频 {audio_count} 段 · 节奏字幕 {text_count} 条",
        )

    @staticmethod
    def _stage_media(src_path: Optional[str], assets_dir: Path, prefix: str) -> Optional[Path]:
        if not src_path or not os.path.isfile(src_path):
            return None
        src = Path(src_path)
        dest = assets_dir / f"{prefix}{src.suffix.lower() or '.mp4'}"
        shutil.copy2(src, dest)
        return dest

    @staticmethod
    def _zip_draft_folder(draft_dir: Path, draft_name: str) -> Path:
        out_dir = REPO_ROOT / "storage" / "temp"
        out_dir.mkdir(parents=True, exist_ok=True)
        zip_file = out_dir / f"{draft_name}.zip"
        with zipfile.ZipFile(zip_file, "w", compression=zipfile.ZIP_STORED) as zf:
            for root, _, files in os.walk(draft_dir):
                for fname in files:
                    full = Path(root) / fname
                    rel = Path(draft_name) / full.relative_to(draft_dir)
                    zf.write(full, arcname=str(rel))
        return zip_file

    @staticmethod
    def _split_cues(text: str, max_chars: int = 14) -> List[str]:
        parts = [p.strip() for p in re.split(r"[，。！？；,!?;、\n]+", text) if p.strip()]
        out: List[str] = []
        for p in parts or [text]:
            for i in range(0, len(p), max_chars):
                chunk = p[i : i + max_chars].strip()
                if chunk:
                    out.append(chunk)
        return out or [text[:max_chars]]

    @staticmethod
    def _probe_duration(media_path: str) -> float:
        try:
            res = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", media_path],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10.0,
            )
            if res.returncode == 0 and res.stdout.strip():
                return float(res.stdout.strip())
        except Exception:
            pass
        return 0.0
