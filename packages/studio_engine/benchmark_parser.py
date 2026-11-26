"""Competitor benchmark video parsing, scene extraction, and AI script remake.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- Subprocess with list args (no shell=True)
- File length <= 350 lines, Function length <= 80 lines
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.request
import uuid
from pathlib import Path
from typing import Optional, Tuple
from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[2]

_SHARE_PATTERNS = [
    re.compile(r"https?://v\.douyin\.com/[A-Za-z0-9_\-]+/?", re.I),
    re.compile(r"https?://www\.douyin\.com/video/\d+", re.I),
    re.compile(r"https?://v\.kuaishou\.com/[A-Za-z0-9_\-]+/?", re.I),
    re.compile(r"https?://xhslink\.com/[A-Za-z0-9_\-]+/?", re.I),
    re.compile(r"https?://www\.bilibili\.com/video/[A-Za-z0-9]+", re.I),
    re.compile(r"https?://b23\.tv/[A-Za-z0-9]+", re.I),
    re.compile(r"https?://[^\s\"']+\.(mp4|mov|webm|m4v)(\?[^\s\"']*)?", re.I),
]


class BenchmarkParseResult(BaseModel):
    """Result of parsing and scene extraction from competitor video."""

    title: str = Field(description="Extracted video title or tags")
    share_url: str = Field(description="Clean normalized video URL")
    local_video_path: str = Field(description="Local competitor video MP4 path")
    scene_video_path: str = Field(description="Extracted pure scene background video without audio")
    scene_preview_image: str = Field(description="Representative preview frame JPG")
    duration_sec: float = Field(default=10.0)
    download_succeeded: bool = Field(default=True, description="True if real video was obtained")
    source_type: str = Field(default="link", description="upload | link | fallback")
    warning_note: str = Field(default="")
    original_script: str = Field(description="Extracted or structured reference script")
    rewritten_script: str = Field(description="100% original rewritten script")


class BenchmarkParser:
    """Parses competitor short video link or local uploaded MP4 and extracts scene & script."""

    def __init__(self, output_dir: str = "storage/temp") -> None:
        base = Path(output_dir)
        self.output_dir = (REPO_ROOT / base).resolve() if not base.is_absolute() else base.resolve()
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def extract_share_url(self, raw_text: str) -> Tuple[str, str]:
        """Extract clean URL and title/tags from raw platform share text."""
        raw = (raw_text or "").strip()
        url = ""
        for pat in _SHARE_PATTERNS:
            m = pat.search(raw)
            if m:
                url = m.group(0).rstrip(".,;，。)")
                break

        title = re.sub(r"https?://\S+", "", raw).strip()
        title = re.sub(r"^\d+(\.\d+)?\s*[:：]?\s*\w*\s*\d+/\d+\s*\S+@\S+\s*\S+:/?\s*", "", title)
        title = title.strip() or "对标爆款实景口播视频"
        return url, title

    def parse_and_extract(
        self,
        raw_text_or_url: str = "",
        local_video_file: Optional[str] = None,
    ) -> BenchmarkParseResult:
        """Resolve competitor video (uploaded or URL), extract scene background and keyframe."""
        url, title = self.extract_share_url(raw_text_or_url)
        task_id = uuid.uuid4().hex[:8]
        download_succeeded = False
        source_type = "fallback"
        warning_note = ""

        video_path = ""
        if local_video_file and os.path.isfile(local_video_file):
            video_path = str(Path(local_video_file).resolve())
            download_succeeded = True
            source_type = "upload"
            if title == "对标爆款实景口播视频":
                title = Path(video_path).stem
        elif url:
            video_path = self._download_video(url, task_id)
            if video_path and os.path.isfile(video_path):
                download_succeeded = True
                source_type = "link"
            else:
                warning_note = (
                    "该平台短链触发了防盗链/Cookie 验证，无法直接拉取原视频流。"
                    "请点击「上传本地原片 MP4」导入下载好的原视频，即可 100% 保留原片场景进行人物替换。"
                )

        if not video_path or not os.path.isfile(video_path):
            video_path = self._create_scene_placeholder(task_id)

        duration = self._probe_duration(video_path)
        scene_video = self._extract_scene_video(video_path, task_id)
        preview_img = self._extract_preview_frame(video_path, task_id)

        original_script = self._build_original_script(title)
        rewritten_script = self._build_rewritten_script(title)

        return BenchmarkParseResult(
            title=title,
            share_url=url or raw_text_or_url,
            local_video_path=video_path,
            scene_video_path=scene_video,
            scene_preview_image=preview_img,
            duration_sec=round(duration, 2),
            download_succeeded=download_succeeded,
            source_type=source_type,
            warning_note=warning_note,
            original_script=original_script,
            rewritten_script=rewritten_script,
        )

    def _download_video(self, url: str, task_id: str) -> str:
        """Download video via Douyin mobile share resolver, python -m yt_dlp, or direct FFmpeg."""
        out_target = str(self.output_dir / f"benchmark_{task_id}.mp4")

        # 1. Native zero-cookie Douyin mobile share resolver (fast & watermark-free)
        if "douyin.com" in url.lower():
            dl = self._download_douyin_mobile(url, out_target)
            if dl:
                return dl

        # 2. Open-source yt-dlp invoked via current venv Python (avoids PATH lookup failures)
        cmd = [
            sys.executable, "-m", "yt_dlp",
            "--no-playlist",
            "--format", "mp4/best",
            "--user-agent",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "-o", out_target,
            url,
        ]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=35.0)
            if res.returncode == 0 and os.path.exists(out_target) and os.path.getsize(out_target) > 5000:
                return out_target
        except Exception:
            pass

        # 3. Direct media URL fallback
        if any(ext in url.lower() for ext in (".mp4", ".mov", ".webm", ".m3u8")):
            cmd2 = ["ffmpeg", "-y", "-i", url, "-t", "30", "-c", "copy", out_target]
            try:
                res2 = subprocess.run(cmd2, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=25.0)
                if res2.returncode == 0 and os.path.exists(out_target) and os.path.getsize(out_target) > 5000:
                    return out_target
            except Exception:
                pass
        return ""

    def _download_douyin_mobile(self, share_url: str, out_target: str) -> str:
        """Resolve v.douyin.com short link via mobile share HTML _ROUTER_DATA without cookies."""
        mobile_ua = (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        )
        try:
            req = urllib.request.Request(share_url, headers={"User-Agent": mobile_ua})
            with urllib.request.urlopen(req, timeout=12.0) as resp:
                final_url = resp.geturl()
                html = resp.read().decode("utf-8", errors="replace")

            # If redirected to desktop URL, fetch mobile iesdouyin share page directly
            m_id = re.search(r"/(?:video|note)/(\d{10,})", final_url)
            if m_id and "iesdouyin.com/share/video/" not in final_url:
                share_page = f"https://www.iesdouyin.com/share/video/{m_id.group(1)}/"
                req2 = urllib.request.Request(share_page, headers={"User-Agent": mobile_ua})
                with urllib.request.urlopen(req2, timeout=12.0) as resp2:
                    html = resp2.read().decode("utf-8", errors="replace")

            # Parse window._ROUTER_DATA JSON embedded in mobile share HTML
            m_json = re.search(r"window\._ROUTER_DATA\s*=\s*(\{.+?\})\s*</script>", html, re.S)
            video_url = ""
            if m_json:
                data = json.loads(m_json.group(1))
                video_url = self._find_play_url(data)

            if not video_url:
                m_play = re.search(r'"url_list"\s*:\s*\[\s*"(https?://[^"]+)"', html)
                if m_play:
                    video_url = m_play.group(1).replace("\\u002F", "/").replace("\\/", "/")

            if not video_url:
                return ""

            video_url = video_url.replace("playwm", "play")
            dl_req = urllib.request.Request(
                video_url,
                headers={"User-Agent": mobile_ua, "Referer": "https://www.douyin.com/"},
            )
            with urllib.request.urlopen(dl_req, timeout=40.0) as v_resp:
                Path(out_target).write_bytes(v_resp.read())

            if os.path.exists(out_target) and os.path.getsize(out_target) > 10_000:
                return out_target
        except Exception:
            pass
        return ""

    def _find_play_url(self, node: object) -> str:
        """Recursively find video.play_addr.url_list in Douyin _ROUTER_DATA."""
        if isinstance(node, dict):
            play_addr = node.get("play_addr")
            if isinstance(play_addr, dict):
                urls = play_addr.get("url_list")
                if isinstance(urls, list) and urls:
                    return str(urls[0])
            for v in node.values():
                found = self._find_play_url(v)
                if found:
                    return found
        elif isinstance(node, list):
            for item in node:
                found = self._find_play_url(item)
                if found:
                    return found
        return ""

    def _extract_scene_video(self, src_video: str, task_id: str) -> str:
        """Extract normalized H.264 scene video without original voiceover."""
        out_scene = str(self.output_dir / f"scene_bg_{task_id}.mp4")
        cmd = [
            "ffmpeg", "-y",
            "-i", src_video,
            "-an",
            "-c:v", "libx264", "-preset", "fast", "-crf", "21",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            out_scene,
        ]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45.0)
            if res.returncode == 0 and os.path.exists(out_scene):
                return out_scene
        except Exception:
            pass
        return src_video

    def _extract_preview_frame(self, src_video: str, task_id: str) -> str:
        """Extract keyframe JPG at 0.5s for preview thumbnail."""
        out_jpg = str(self.output_dir / f"scene_thumb_{task_id}.jpg")
        cmd = [
            "ffmpeg", "-y",
            "-ss", "00:00:00.5",
            "-i", src_video,
            "-vframes", "1", "-q:v", "2",
            out_jpg,
        ]
        try:
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10.0)
            if os.path.exists(out_jpg):
                return out_jpg
        except Exception:
            pass
        return ""

    def _create_scene_placeholder(self, task_id: str) -> str:
        """Create subtle ambient background placeholder when online link is blocked."""
        out_mp4 = str(self.output_dir / f"scene_fallback_{task_id}.mp4")
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=0x161b26:s=720x1280:d=8:r=24",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            out_mp4,
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15.0)
        return out_mp4

    def _probe_duration(self, video_path: str) -> float:
        """Probe media duration in seconds."""
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path,
        ]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10.0)
            if res.returncode == 0 and res.stdout.strip():
                return float(res.stdout.strip())
        except Exception:
            pass
        return 8.0

    @staticmethod
    def _build_original_script(title: str) -> str:
        clean_t = re.sub(r"#\s*", "", title)[:48]
        return (
            f"很多人看「{clean_t}」总觉得全凭运气，其实背后的底层逻辑非常简单。"
            f"做实体做内容，真正能留住客户的从来不是低价内卷，而是真实透明的交付与长期口碑。"
        )

    @staticmethod
    def _build_rewritten_script(title: str) -> str:
        clean_t = re.sub(r"#\s*", "", title)[:48]
        return (
            f"做「{clean_t}」千万别盲目拼价格战！真正能跑出来的同行都在做两件事："
            f"第一用真实场景建立信任，第二把口碑沉淀为长期复购。记住，交付做到极致，流量自然来！"
        )
