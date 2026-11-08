"""Unit tests for Core Operators and OperatorRegistry."""

import asyncio
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import operators  # Triggers operator registration
from operators.script_operator import ScriptInput, ScriptOperator
from packages.studio_engine.registry import OperatorRegistry


def test_operator_registry_discovery():
    """Verify that all core operators are registered with valid metadata."""
    ops = OperatorRegistry.list_all()
    op_ids = {op["op_id"] for op in ops}

    expected_ids = {
        "op_script_storyboard",
        "op_voice_tts",
        "op_image_motion",
        "op_smart_editor",
        "op_motion_text",
        "op_digital_human",
    }
    for eid in expected_ids:
        assert eid in op_ids, f"Operator {eid} should be registered"

    # Verify category filtering
    voice_ops = OperatorRegistry.list_by_category("07-voice-studio")
    assert any(op["op_id"] == "op_voice_tts" for op in voice_ops)


def test_script_operator_locked_keys_refine():
    """Verify ScriptOperator strictly preserves locked shots during refine."""
    op = ScriptOperator()

    # Initial script
    init_in = ScriptInput(prompt="测试AI工作流", shot_count=3)
    init_out = asyncio.run(op.execute(init_in, {}))
    assert len(init_out.shots) == 3

    shot_01_orig = init_out.shots[0].model_copy()

    # Refine with shot_01 locked
    refine_in = ScriptInput(
        prompt="测试AI工作流",
        shot_count=3,
        base_script=init_out,
        refine_instruction="第2第3镜改生动些",
        locked_keys=["shot_01"],
    )
    refine_out = asyncio.run(op.execute(refine_in, {}))

    # Shot 01 must be identical
    assert refine_out.shots[0].narration == shot_01_orig.narration
    assert refine_out.shots[0].is_locked is True

    # Shot 02 and 03 must have applied the refine instruction
    assert "第2第3镜改生动些" in refine_out.shots[1].narration
    assert "第2第3镜改生动些" in refine_out.shots[2].narration


if __name__ == "__main__":
    test_operator_registry_discovery()
    test_script_operator_locked_keys_refine()
    print("ALL MODULE 3 OPERATOR TESTS PASSED SUCCESSFULLY!")
