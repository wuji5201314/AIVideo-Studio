"""Unit tests for DAG planner, fingerprint caching, and cancellation token."""

import shutil
import sys
import tempfile
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from packages.studio_engine import (
    CancellationToken,
    CostType,
    DagPlanner,
    FeedbackMode,
    NodeFeedbackRequest,
    NodeStatus,
    OperationCancelledError,
    PlanActionType,
    WorkflowStore,
    compute_shot_render_fingerprint,
    compute_shot_visual_fingerprint,
    compute_shot_voice_fingerprint,
)


def test_per_shot_fingerprint_isolation():
    """Verify modifying narration only invalidates voice, not visual."""
    v_config = {"voice": "zh-CN-YunxiNeural", "rate": "+0%"}
    img_config = {"provider": "pexels", "aspect_ratio": "9:16"}

    # Initial shot 01
    narration_v1 = "今天我们来聊聊如何用AI做视频"
    prompt_v1 = "科技感工作台特写，屏幕发光"

    voice_fp1 = compute_shot_voice_fingerprint(narration_v1, v_config)
    visual_fp1 = compute_shot_visual_fingerprint(prompt_v1, img_config)
    clip_fp1 = compute_shot_render_fingerprint(voice_fp1, visual_fp1, {"motion": "zoom_in"})

    # Modify narration in v2, keep prompt unchanged
    narration_v2 = "今天我们聊聊用AI做视频的极简技巧"
    voice_fp2 = compute_shot_voice_fingerprint(narration_v2, v_config)
    visual_fp2 = compute_shot_visual_fingerprint(prompt_v1, img_config)
    clip_fp2 = compute_shot_render_fingerprint(voice_fp2, visual_fp2, {"motion": "zoom_in"})

    assert voice_fp1 != voice_fp2, "Voice fingerprint must change when narration changes"
    assert visual_fp1 == visual_fp2, "Visual fingerprint must remain identical"
    assert clip_fp1 != clip_fp2, "Clip fingerprint must change when voice changes"


def test_dag_planner_feedback_locked_keys():
    """Verify locked shots are marked as REUSE with 0 cost."""
    temp_dir = Path(tempfile.mkdtemp(prefix="test-planner-"))
    try:
        store = WorkflowStore(temp_dir)
        store.create_project("proj_test", "测试项目", "测试简介")

        # Mock N03 script revision with 2 shots
        shots_data = {
            "title": "测试成片",
            "shots": [
                {"shot_id": "shot_01", "narration": "第一句", "visual_prompt": "画面1"},
                {"shot_id": "shot_02", "narration": "第二句", "visual_prompt": "画面2"},
            ]
        }
        store.upsert_node("proj_test", "N03_SCRIPT", "N03_SCRIPT", 3, "SUCCEEDED")
        store.add_revision("rev_script_v1", "proj_test", "N03_SCRIPT", "INITIAL", "fp1", shots_data)

        planner = DagPlanner(store)

        # User refines shot_02 while locking shot_01
        feedback = NodeFeedbackRequest(
            base_rev_id="rev_script_v1",
            mode=FeedbackMode.REFINE,
            instruction="第二句更简洁点",
            locked_keys=["shot_01"],
        )

        plan = planner.plan_feedback("proj_test", "N03_SCRIPT", feedback)
        assert plan.base_revision == "rev_script_v1"

        actions_map = {a.node_key: a for a in plan.actions}
        assert "N03_SCRIPT" in actions_map
        assert actions_map["N03_SCRIPT"].action == PlanActionType.REFINE
        assert actions_map["N03_SCRIPT"].cost_type == CostType.LLM

        assert "N05_VOICE:shot_01" in actions_map
        assert actions_map["N05_VOICE:shot_01"].action == PlanActionType.REUSE
        assert actions_map["N05_VOICE:shot_01"].cost_type == CostType.NONE

        assert "N05_VOICE:shot_02" in actions_map
        assert actions_map["N05_VOICE:shot_02"].action == PlanActionType.BUILD
        assert actions_map["N05_VOICE:shot_02"].cost_type == CostType.TTS

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_stale_propagation():
    """Verify modifying upstream marks downstream as STALE."""
    temp_dir = Path(tempfile.mkdtemp(prefix="test-stale-"))
    try:
        store = WorkflowStore(temp_dir)
        store.create_project("proj_stale", "测试项目", "测试简介")

        store.upsert_node("proj_stale", "N03_SCRIPT", "N03_SCRIPT", 3, "SUCCEEDED")
        store.upsert_node("proj_stale", "N05_VOICE", "N05_VOICE", 4, "SUCCEEDED")
        store.upsert_node("proj_stale", "N06_MATERIAL", "N06_MATERIAL", 5, "SUCCEEDED")

        planner = DagPlanner(store)
        stale_nodes = planner.propagate_stale("proj_stale", "N03_SCRIPT")

        assert "N05_VOICE" in stale_nodes
        assert "N06_MATERIAL" in stale_nodes

        voice_node = store.get_node("proj_stale", "N05_VOICE")
        assert voice_node["status"] == NodeStatus.STALE.value

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_cancellation_token():
    """Verify CancellationToken throws OperationCancelledError."""
    token = CancellationToken()
    assert not token.is_cancelled()
    token.throw_if_cancelled()

    token.cancel()
    assert token.is_cancelled()
    try:
        token.throw_if_cancelled()
        assert False, "Should have raised OperationCancelledError"
    except OperationCancelledError:
        pass


if __name__ == "__main__":
    test_per_shot_fingerprint_isolation()
    test_dag_planner_feedback_locked_keys()
    test_stale_propagation()
    test_cancellation_token()
    print("ALL MODULE 2 DAG TESTS PASSED SUCCESSFULLY!")
