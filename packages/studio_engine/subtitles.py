"""Subtitle generation and rhythm alignment for Douyin / TikTok style video workflows.

Follows Alibaba Coding Guidelines:
- Strict typing, no any
- Pure functions, <= 80 lines per function
- File <= 400 lines
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import List, Tuple


def split_text_into_rhythm_cues(text: str, min_chars: int = 5, max_chars: int = 14) -> List[str]:
    """Split narration text into punchy rhythmic cues suitable for short-video subtitles."""
    raw = (text or "").strip()
    if not raw:
        return ["欢迎体验数字人口播工作台"]

    # Split on common punctuation
    clauses = re.split(r"[，。！？；,!?;、\n]+", raw)
    parts = [c.strip() for c in clauses if c.strip()]
    if not parts:
        parts = [raw]

    cues: List[str] = []
    for part in parts:
        if len(part) <= max_chars:
            cues.append(part)
        else:
            # Chunk longer part into units of max_chars
            for i in range(0, len(part), max_chars):
                chunk = part[i : i + max_chars]
                if len(chunk) < min_chars and cues:
                    cues[-1] = f"{cues[-1]}{chunk}"
                else:
                    cues.append(chunk)

    return cues if cues else [raw[:max_chars]]


def format_ass_time(seconds: float) -> str:
    """Format seconds into ASS timestamp: H:MM:SS.cs."""
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:
        cs = 99
    return f"{hrs}:{mins:02d}:{secs:02d}.{cs:02d}"


def generate_douyin_subtitles(
    text: str,
    total_duration: float,
    output_ass: Path,
    style_theme: str = "douyin_yellow",
    video_width: int = 1080,
    video_height: int = 1920,
) -> Path:
    """Generate rhythmic ASS subtitle file with Douyin/TikTok high-impact styling."""
    cues = split_text_into_rhythm_cues(text)
    total_chars = sum(len(c) for c in cues) or 1
    duration = max(1.0, float(total_duration))

    # Calculate proportional timing for each cue based on character length
    time_slices: List[Tuple[float, float, str]] = []
    current_time = 0.0
    for idx, cue in enumerate(cues):
        ratio = len(cue) / total_chars
        cue_dur = max(0.8, duration * ratio)
        start_t = current_time
        end_t = min(duration, current_time + cue_dur)
        if idx == len(cues) - 1:
            end_t = duration
        time_slices.append((start_t, end_t, cue))
        current_time = end_t
        if current_time >= duration:
            break

    # Style definitions
    # PrimaryColour: &H00BBGGRR -> Yellow: &H0000E5FF or &H0000FFFF (BGR)
    # White: &H00FFFFFF
    primary_color = "&H0000FFFF" if style_theme == "douyin_yellow" else "&H00FFFFFF"
    font_size = 56 if video_width <= 1080 else 64
    margin_v = 170

    ass_content = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {video_width}",
        f"PlayResY: {video_height}",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: DouyinSubtitle,Microsoft YaHei,{font_size},{primary_color},&H00000000,&H00000000,&H90000000,"
        f"-1,0,0,0,100,100,0,0,1,3.2,1.8,2,40,40,{margin_v},1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    for start_t, end_t, cue_text in time_slices:
        start_str = format_ass_time(start_t)
        end_str = format_ass_time(end_t)
        escaped_cue = cue_text.replace("\n", "\\N").replace("{", "(").replace("}", ")")
        ass_content.append(
            f"Dialogue: 0,{start_str},{end_str},DouyinSubtitle,,0,0,0,,{escaped_cue}"
        )

    output_ass.parent.mkdir(parents=True, exist_ok=True)
    output_ass.write_text("\n".join(ass_content), encoding="utf-8")
    return output_ass
