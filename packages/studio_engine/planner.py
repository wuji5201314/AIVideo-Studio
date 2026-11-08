"""DAG execution planner and incremental diff analysis.

Follows Alibaba Coding Guidelines:
- Guard clauses to avoid deep nesting (depth <= 3)
- Explicit reasons for every action
- File length <= 400 lines
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from packages.studio_engine.models import (
    CostType,
    ExecutionPlan,
    FeedbackMode,
    NodeFeedbackRequest,
    NodeStatus,
    PlanAction,
    PlanActionType,
)
from packages.studio_engine.store import WorkflowStore

STANDARD_NODE_ORDER = [
    "N01_BRIEF",
    "N02_TOPIC",
    "N03_SCRIPT",
    "N05_VOICE",
    "N06_MATERIAL",
    "N07_SHOT_RENDER",
    "N08_SUBTITLE",
    "N09_ASSEMBLY",
    "N10_DIGITAL_HUMAN",
    "N11_EXPORT",
    "N12_PUBLISH",
]


class DagPlanner:
    """Calculates dry-run execution plans and handles STALE invalidation."""

    def __init__(self, store: WorkflowStore) -> None:
        self.store = store

    def propagate_stale(self, project_id: str, start_node_key: str) -> List[str]:
        """Mark all downstream nodes as STALE without deleting existing artifacts."""
        if start_node_key not in STANDARD_NODE_ORDER:
            return []

        start_idx = STANDARD_NODE_ORDER.index(start_node_key)
        downstream = STANDARD_NODE_ORDER[start_idx + 1:]
        stale_keys: List[str] = []

        for key in downstream:
            node = self.store.get_node(project_id, key)
            if not node:
                continue
            if node["status"] in (NodeStatus.SUCCEEDED.value, NodeStatus.WAITING_GATE.value):
                self.store.upsert_node(
                    project_id=project_id,
                    node_key=key,
                    node_type=node["node_type"],
                    order_no=node["order_no"],
                    status=NodeStatus.STALE.value,
                    gate_enabled=bool(node["gate_enabled"]),
                    locked=bool(node["locked"]),
                )
                stale_keys.append(key)
        return stale_keys

    def plan_feedback(
        self,
        project_id: str,
        node_key: str,
        feedback: NodeFeedbackRequest,
    ) -> ExecutionPlan:
        """Compute execution plan for a specific feedback action."""
        actions: List[PlanAction] = []
        base_rev = self.store.get_revision(feedback.base_rev_id)
        output_data = json.loads(base_rev["output_json"]) if base_rev else {}

        if feedback.mode == FeedbackMode.APPROVE:
            actions.append(PlanAction(
                node_key=node_key,
                action=PlanActionType.REUSE,
                reason="用户确认通过当前产物，冻结版本",
                cost_type=CostType.NONE,
            ))
            return ExecutionPlan(
                project_id=project_id,
                base_revision=feedback.base_rev_id,
                actions=actions,
                estimated_reuse_count=1,
                estimated_build_count=0,
            )

        if feedback.mode == FeedbackMode.PATCH:
            actions.append(PlanAction(
                node_key=node_key,
                action=PlanActionType.PATCH,
                reason="应用手动修改补丁，不消耗大模型或外部API",
                cost_type=CostType.NONE,
                affected_shot_ids=list(feedback.manual_patches.keys()),
            ))

        elif feedback.mode == FeedbackMode.REFINE:
            actions.append(PlanAction(
                node_key=node_key,
                action=PlanActionType.REFINE,
                reason=f"基于指令增量调整，保护锁定项: {feedback.locked_keys}",
                cost_type=CostType.LLM,
                affected_shot_ids=[k for k in feedback.locked_keys],
            ))

        # Analyze downstream impact
        self._analyze_downstream_impact(node_key, feedback, output_data, actions)

        reuse_cnt = sum(1 for a in actions if a.action == PlanActionType.REUSE)
        build_cnt = len(actions) - reuse_cnt

        return ExecutionPlan(
            project_id=project_id,
            base_revision=feedback.base_rev_id,
            actions=actions,
            estimated_reuse_count=reuse_cnt,
            estimated_build_count=build_cnt,
        )

    def _analyze_downstream_impact(
        self,
        node_key: str,
        feedback: NodeFeedbackRequest,
        output_data: Dict[str, Any],
        actions: List[PlanAction],
    ) -> None:
        """Helper to append downstream impact actions based on locked keys."""
        if node_key != "N03_SCRIPT":
            return

        shots = output_data.get("shots", [])
        locked_set = set(feedback.locked_keys)

        for shot in shots:
            sid = shot.get("shot_id", "")
            if sid in locked_set:
                actions.append(PlanAction(
                    node_key=f"N05_VOICE:{sid}",
                    action=PlanActionType.REUSE,
                    reason=f"分镜 {sid} 已锁定，复用已有配音音频",
                    cost_type=CostType.NONE,
                    affected_shot_ids=[sid],
                ))
                actions.append(PlanAction(
                    node_key=f"N06_MATERIAL:{sid}",
                    action=PlanActionType.REUSE,
                    reason=f"分镜 {sid} 已锁定，复用已有视觉素材",
                    cost_type=CostType.NONE,
                    affected_shot_ids=[sid],
                ))
            else:
                actions.append(PlanAction(
                    node_key=f"N05_VOICE:{sid}",
                    action=PlanActionType.BUILD,
                    reason=f"分镜 {sid} 重新生成口播文本，需重录TTS",
                    cost_type=CostType.TTS,
                    affected_shot_ids=[sid],
                ))
