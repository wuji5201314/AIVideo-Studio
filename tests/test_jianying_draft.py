"""Tests for JianYing Pro draft exporter (pyJianYingDraft) and draft routes."""

from __future__ import annotations

import os
from pathlib import Path
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_jianying_info_endpoint() -> None:
    resp = client.get("/api/v2/drafts/jianying/info")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "00000"
    assert "detected" in body["data"]


def test_jianying_draft_export_creates_real_draft_and_zip() -> None:
    resp = client.post(
        "/api/v2/drafts/jianying/export",
        json={
            "project_name": "测试剪映多轨草稿",
            "aspect_ratio": "9:16",
            "write_to_jianying_dir": False,
            "shots": [
                {
                    "headline": "开场痛点",
                    "narration": "实体店做短视频最关键的不是设备，而是真实场景与高频更新。",
                    "duration_sec": 4.5,
                },
                {
                    "headline": "行动引导",
                    "narration": "一键导出剪映草稿，打开剪映套用官方花字直接发！",
                    "duration_sec": 3.5,
                },
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "00000"
    data = body["data"]
    draft_dir = Path(data["draft_dir"])
    zip_path = Path(data["zip_path"])

    assert draft_dir.is_dir()
    assert (draft_dir / "draft_content.json").is_file()
    assert zip_path.is_file()
    assert os.path.getsize(zip_path) > 500
    assert data["total_duration_sec"] == 8.0
