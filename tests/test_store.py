"""Unit tests for WorkflowStore and atomic CAS operations."""

import shutil
import sys
import tempfile
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from packages.studio_engine.store import WorkflowStore


def test_workflow_store_crud():
    temp_dir = Path(tempfile.mkdtemp(prefix="test-wf-store-"))
    try:
        store = WorkflowStore(temp_dir)

        # 1. Test Project creation
        store.create_project("proj_001", "测试项目", "一个AI视频简介")
        proj = store.get_project("proj_001")
        assert proj is not None
        assert proj["title"] == "测试项目"
        assert proj["status"] == "IDLE"

        # 2. Test Node upsert
        store.upsert_node(
            project_id="proj_001",
            node_key="N02_TOPIC",
            node_type="N02_TOPIC",
            order_no=2,
            status="READY",
            gate_enabled=True,
        )
        node = store.get_node("proj_001", "N02_TOPIC")
        assert node is not None
        assert node["status"] == "READY"
        assert node["gate_enabled"] == 1

        # 3. Test CAS Blob put and resolve
        data = b"Hello AIVideo Studio CAS Storage"
        sha = store.put_blob("text", data, {"extension": "txt"})
        assert len(sha) == 64
        blob_path = store.get_blob_path(sha)
        assert blob_path is not None
        assert blob_path.exists()
        assert blob_path.read_bytes() == data

        # 4. Test Node Revisions append-only
        rev_num1 = store.add_revision(
            rev_id="rev_001",
            project_id="proj_001",
            node_key="N02_TOPIC",
            trigger_mode="INITIAL",
            fingerprint="fp_12345",
            output_data={"topic": "AI 视频制作技巧"},
        )
        assert rev_num1 == 1

        rev_num2 = store.add_revision(
            rev_id="rev_002",
            project_id="proj_001",
            node_key="N02_TOPIC",
            parent_rev_id="rev_001",
            trigger_mode="REFINE",
            fingerprint="fp_67890",
            output_data={"topic": "AI 视频制作高阶指南"},
        )
        assert rev_num2 == 2

        # Verify current_rev_id on node was updated to rev_002
        updated_node = store.get_node("proj_001", "N02_TOPIC")
        assert updated_node["current_rev_id"] == "rev_002"

        revs = store.list_revisions("proj_001", "N02_TOPIC")
        assert len(revs) == 2
        assert revs[0]["rev_id"] == "rev_002"
        assert revs[1]["rev_id"] == "rev_001"
        print("ALL TESTS PASSED SUCCESSFULLY!")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    test_workflow_store_crud()

