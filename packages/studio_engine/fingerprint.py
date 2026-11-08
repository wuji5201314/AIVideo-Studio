"""Field-level SHA256 fingerprinting for AIVideo-Studio DAG nodes.

Follows Alibaba Coding Guidelines:
- Deterministic canonical hashing
- Fine-grained per-shot fingerprint calculation
- File length <= 400 lines
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List


def canonical_json(obj: Any) -> str:
    """Serialize object to compact, deterministic JSON with sorted keys."""
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def compute_sha256(text: str) -> str:
    """Compute standard hexadecimal SHA256 hash."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def compute_node_fingerprint(
    node_type: str,
    config: Dict[str, Any],
    input_hashes: List[str],
    version: str = "v1",
) -> str:
    """Compute overall node fingerprint based on type, config and input hashes.

    Formula: SHA256(NodeType || Version || CanonicalJSON(Config) || Inputs)
    """
    payload = "|".join([
        node_type,
        version,
        canonical_json(config),
        *sorted(input_hashes),
    ])
    return compute_sha256(payload)


def compute_shot_voice_fingerprint(
    narration: str,
    voice_config: Dict[str, Any],
) -> str:
    """Compute fingerprint for single shot voiceover audio.

    Only changes if narration text or TTS params (voice, rate, volume) change.
    """
    relevant_config = {
        "voice": voice_config.get("voice", "zh-CN-YunxiNeural"),
        "rate": voice_config.get("rate", "+0%"),
        "volume": voice_config.get("volume", "+0%"),
        "pitch": voice_config.get("pitch", "+0Hz"),
    }
    payload = f"VOICE|{narration.strip()}|{canonical_json(relevant_config)}"
    return compute_sha256(payload)


def compute_shot_visual_fingerprint(
    visual_prompt: str,
    visual_config: Dict[str, Any],
) -> str:
    """Compute fingerprint for single shot visual material (image/video).

    Only changes if visual prompt or provider/model settings change.
    """
    relevant_config = {
        "provider": visual_config.get("provider", "local"),
        "aspect_ratio": visual_config.get("aspect_ratio", "9:16"),
        "style": visual_config.get("style", "default"),
        "seed": visual_config.get("seed", 0),
    }
    payload = f"VISUAL|{visual_prompt.strip()}|{canonical_json(relevant_config)}"
    return compute_sha256(payload)


def compute_shot_render_fingerprint(
    voice_fp: str,
    visual_fp: str,
    render_config: Dict[str, Any],
) -> str:
    """Compute fingerprint for single shot rendered video clip.

    Changes if either voice or visual changes, or motion effect changes.
    """
    relevant_config = {
        "motion": render_config.get("motion", "zoom_in"),
        "fit_mode": render_config.get("fit_mode", "cover"),
    }
    payload = f"CLIP|{voice_fp}|{visual_fp}|{canonical_json(relevant_config)}"
    return compute_sha256(payload)
