"""Integration tests for FastAPI REST Gateway and Alibaba ResultEnvelope."""

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_endpoint():
    """Verify health endpoint returns standard envelope."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == "00000"
    assert data["message"] == "ok"
    assert data["data"]["status"] == "running"
    assert "request_id" in data


def test_list_operators():
    """Verify operators endpoint returns registered operators."""
    resp = client.get("/api/v2/operators")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "00000"
    ops = body["data"]
    assert len(ops) >= 6
    op_ids = {op["op_id"] for op in ops}
    assert "op_script_storyboard" in op_ids
    assert "op_voice_tts" in op_ids


def test_execute_operator_gateway():
    """Verify universal operator execution gateway."""
    payload = {
        "input": {
            "prompt": "如何用AI剪辑短视频",
            "shot_count": 3
        },
        "config": {}
    }
    resp = client.post("/api/v2/operators/op_script_storyboard/execute", json=payload)
    if resp.status_code != 200:
        print("ERROR BODY:", resp.json())
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "00000"
    data = body["data"]
    assert len(data["shots"]) == 3
    assert "如何用AI剪辑短视频" in data["title"]


def test_project_workflow_crud():
    """Verify full project creation and DAG status retrieval."""
    # 1. Create project
    create_payload = {
        "title": "测试API项目",
        "brief": "一个完整的节点化工作流测试",
        "preset": "standard_12_nodes",
    }
    resp = client.post("/api/v2/projects", json=create_payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "00000"
    proj_id = body["data"]["project_id"]

    # 2. Get DAG
    resp_dag = client.get(f"/api/v2/projects/{proj_id}")
    assert resp_dag.status_code == 200
    dag_body = resp_dag.json()
    assert dag_body["code"] == "00000"
    nodes = dag_body["data"]["nodes"]
    assert len(nodes) == 11
    assert nodes[0]["node_key"] == "N01_BRIEF"
    assert nodes[0]["status"] == "READY"


def test_asset_save_list_and_stream():
    """Verify saving generated temp files to CAS library, listing, and streaming."""
    temp_dir = PROJECT_ROOT / "storage" / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    sample_mp3 = temp_dir / "tts-test-sample.mp3"
    sample_mp3.write_bytes(b"ID3-fake-mp3-audio-payload")

    # 1. Stream directly from storage/temp
    stream_resp = client.get("/api/v2/assets/stream", params={"path": str(sample_mp3)})
    assert stream_resp.status_code == 200
    assert stream_resp.content == b"ID3-fake-mp3-audio-payload"

    # 2. Save to CAS asset library
    save_resp = client.post(
        "/api/v2/assets/save",
        json={
            "file_path": str(sample_mp3),
            "kind": "audio",
            "title": "单元测试配音",
            "meta": {"prompt": "单元测试台词"},
        },
    )
    assert save_resp.status_code == 200
    save_body = save_resp.json()
    assert save_body["code"] == "00000"
    sha256 = save_body["data"]["sha256"]
    assert len(sha256) == 64

    # 3. List assets in library
    list_resp = client.get("/api/v2/assets", params={"kind": "audio"})
    assert list_resp.status_code == 200
    items = list_resp.json()["data"]
    assert any(item["sha256"] == sha256 for item in items)


if __name__ == "__main__":
    test_health_endpoint()
    test_list_operators()
    test_execute_operator_gateway()
    test_project_workflow_crud()
    test_asset_save_list_and_stream()
    print("ALL MODULE 4 API GATEWAY TESTS PASSED SUCCESSFULLY!")
