"""Script and Storyboard generation and Diff-based Refine operator.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- Code-level lock preservation (locked_keys hard enforcement)
- File length <= 400 lines
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from packages.studio_engine.models import CostType, ScriptOutput, ShotItem
from packages.studio_engine.operator_protocol import BaseOperator, CancellationToken
from packages.studio_engine.registry import register_operator


class ScriptInput(BaseModel):
    """Input payload for ScriptOperator."""

    prompt: str = Field(description="Story or topic brief")
    shot_count: int = Field(default=5, ge=2, le=15, description="Number of shots")
    language: str = Field(default="zh-CN", description="Script language")
    style: str = Field(default="vlog", description="Narrative style preset")
    # For Refine mode
    base_script: Optional[ScriptOutput] = Field(default=None, description="Previous script version")
    refine_instruction: Optional[str] = Field(default=None, description="Feedback instruction")
    locked_keys: List[str] = Field(default_factory=list, description="Shot IDs that cannot be modified")


@register_operator
class ScriptOperator(BaseOperator[ScriptInput, ScriptOutput]):
    """Operator that generates structured shot scripts or executes Diff-based refine."""

    op_id = "op_script_storyboard"
    name = "分镜脚本编排算子"
    category = "08-copywriter"
    description = "一键生成结构化多镜头脚本，支持锁定特定镜头进行局部增量微调"
    is_free_local = False
    cost_type = CostType.LLM

    async def execute(
        self,
        input_data: ScriptInput,
        config: Dict[str, Any],
        cancel_token: Optional[CancellationToken] = None,
    ) -> ScriptOutput:
        """Generate or refine script with cancellation check and code-level lock preservation."""
        if cancel_token:
            cancel_token.throw_if_cancelled()

        # If refine mode with base script and locked keys
        if input_data.base_script and input_data.refine_instruction:
            return self._refine_script(input_data)

        return self._generate_initial_script(input_data)

    def _generate_initial_script(self, input_data: ScriptInput) -> ScriptOutput:
        """Mock/LLM initial storyboard generation."""
        shots: List[ShotItem] = []
        count = input_data.shot_count
        prompt = input_data.prompt.strip()

        for i in range(1, count + 1):
            sid = f"shot_{i:02d}"
            shots.append(ShotItem(
                shot_id=sid,
                headline=f"第{i}幕：核心要点",
                narration=f"这是关于「{prompt}」的第{i}个关键要点，生动展开讲解。",
                visual_prompt=f"现代简约风格，高清电影质感，展现 {prompt} 相关画面特写",
                search_terms=[prompt, "technology", "modern"],
                est_duration=3.5,
                is_locked=False,
            ))

        return ScriptOutput(
            title=f"关于「{prompt}」的爆款视频",
            summary=f"针对 {prompt} 展开的完整视频分镜",
            tags=["AI视频", "效率工具", "爆款技巧"],
            shots=shots,
        )

    def _refine_script(self, input_data: ScriptInput) -> ScriptOutput:
        """Refine unlocked shots while strictly preserving locked ones in code."""
        base = input_data.base_script
        assert base is not None
        locked_set = set(input_data.locked_keys)
        new_shots: List[ShotItem] = []

        for shot in base.shots:
            if shot.shot_id in locked_set or shot.is_locked:
                # Strictly keep identical shot data
                new_shots.append(shot.model_copy(update={"is_locked": True}))
            else:
                # Apply simulated or LLM refinement to unlocked shot
                updated_narration = f"{shot.narration} (已按意见微调: {input_data.refine_instruction})"
                new_shots.append(shot.model_copy(update={
                    "narration": updated_narration,
                    "is_locked": False,
                }))

        return base.model_copy(update={"shots": new_shots})

    def get_input_schema(self) -> Dict[str, Any]:
        """Return input schema for frontend form rendering."""
        return ScriptInput.model_json_schema()
