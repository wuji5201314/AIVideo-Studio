"""Tests for Wan2.2-Animate multi-backend router, settings store, and avatar gateway routes."""

from __future__ import annotations

from pathlib import Path
from fastapi.testclient import TestClient

from main import app
from packages.studio_engine.settings_store import SettingsStore
from packages.studio_engine.wan_animate import WanAnimateRouter

client = TestClient(app)


def test_settings_store_persistence_and_masking(tmp_path: Path) -> None:
    store = SettingsStore(db_path=tmp_path / "test_settings.db")
    saved = store.save_avatar_settings({
        "active_backend": "comfyui",
        "comfyui_url": "http://192.168.1.50:8188",
        "dashscope_api_key": "sk-test1234567890",
        "use_relighting_lora": False,
    })
    assert saved.active_backend == "comfyui"
    assert saved.comfyui_url == "http://192.168.1.50:8188"
    assert saved.use_relighting_lora is False

    masked = store.masked_dict(saved)
    assert masked["has_dashscope_key"] is True
    assert masked["dashscope_api_key"].startswith("sk-***")
    assert masked["dashscope_api_key"].endswith("7890")


def test_wan_animate_router_probes_all_backends() -> None:
    router = WanAnimateRouter()
    health_list = router.probe_all()
    ids = {h.backend_id for h in health_list}
    assert {"comfyui", "wan_worker", "dashscope", "local_fallback"} <= ids
    local_h = next(h for h in health_list if h.backend_id == "local_fallback")
    assert local_h.available is True


def test_avatar_engines_endpoint() -> None:
    resp = client.get("/api/v2/avatar/engines")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "00000"
    assert len(body["data"]["backends"]) == 4
    assert body["data"]["resolved_backend"] in ("comfyui", "wan_worker", "dashscope", "local_fallback")


def test_avatar_upload_and_benchmark_parse(tmp_path: Path) -> None:
    # Upload a small dummy image to verify multipart endpoint
    img_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 128
    up = client.post(
        "/api/v2/avatar/upload",
        files={"file": ("portrait.png", img_bytes, "image/png")},
        data={"kind": "image"},
    )
    assert up.status_code == 200
    up_body = up.json()
    assert up_body["code"] == "00000"
    assert Path(up_body["data"]["file_path"]).is_file()

    # Parse a share text (extracts title cleanly even when platform blocks download)
    parse = client.post(
        "/api/v2/avatar/benchmark/parse",
        json={"share_url": "00后家具人，交易随缘定 # 实体家具店日常 https://v.douyin.com/fake123/"},
    )
    assert parse.status_code == 200
    p_data = parse.json()["data"]
    assert "00后家具人" in p_data["title"]
    assert Path(p_data["scene_video_path"]).is_file()
