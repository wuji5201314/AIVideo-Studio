"""Tests for TemplateVideoOperator and real FFmpeg SmartEditorOperator."""

from __future__ import annotations

import os
from pathlib import Path
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_template_video_operator_generates_real_mp4(tmp_path: Path) -> None:
    resp = client.post(
        "/api/v2/operators/op_template_video/execute",
        json={
            "input": {
                "template_id": "knowledge_card",
                "title": "实体店引流3大法则",
                "badge_text": "行业干货 · 实测",
                "script": "实体店做短视频最关键的是真实场景与高频更新。",
                "bullet_points": ["真实场景建立信任", "痛点开场留人", "模板批量提效"],
                "subtitle_style": "douyin_yellow",
                "aspect_ratio": "9:16",
                "output_dir": str(tmp_path),
            }
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "00000"
    video_path = body["data"]["video_path"]
    assert os.path.isfile(video_path)
    assert os.path.getsize(video_path) > 10_000
    assert body["data"]["resolution"] == "1080x1920"


def test_smart_editor_real_silence_cutting(tmp_path: Path) -> None:
    # When video_path is empty, SmartEditorOperator synthesizes a 4s sample with a 1s silent pause
    resp = client.post(
        "/api/v2/operators/op_smart_editor/execute",
        json={
            "input": {
                "operation": "cut_silence",
                "silence_db": -30.0,
                "min_silence_sec": 0.35,
                "output_dir": str(tmp_path),
            }
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "00000"
    data = body["data"]
    assert os.path.isfile(data["output_video_path"])
    assert data["silence_segments_cut"] >= 1
    assert data["final_duration_sec"] < data["original_duration_sec"]
