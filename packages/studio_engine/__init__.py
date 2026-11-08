"""Studio Engine: Microkernel for AIVideo-Studio.

Contains the DAG state machine, content-addressed fingerprinting,
incremental feedback processor, and SQLite revision storage.
"""

from packages.studio_engine.executor import EventBus, WorkflowExecutor
from packages.studio_engine.fingerprint import (
    canonical_json,
    compute_node_fingerprint,
    compute_sha256,
    compute_shot_render_fingerprint,
    compute_shot_visual_fingerprint,
    compute_shot_voice_fingerprint,
)
from packages.studio_engine.models import (
    CostType,
    ExecutionPlan,
    FeedbackMode,
    NodeFeedbackRequest,
    NodeStatus,
    PlanAction,
    PlanActionType,
    ProjectCreateRequest,
    ProjectStatus,
    ScriptOutput,
    ShotItem,
)
from packages.studio_engine.operator_protocol import (
    BaseOperator,
    CancellationToken,
    OperationCancelledError,
)
from packages.studio_engine.planner import DagPlanner
from packages.studio_engine.registry import OperatorRegistry, register_operator
from packages.studio_engine.store import WorkflowStore

__all__ = [
    "WorkflowStore",
    "DagPlanner",
    "WorkflowExecutor",
    "EventBus",
    "BaseOperator",
    "CancellationToken",
    "OperationCancelledError",
    "OperatorRegistry",
    "register_operator",
    "canonical_json",
    "compute_sha256",
    "compute_node_fingerprint",
    "compute_shot_voice_fingerprint",
    "compute_shot_visual_fingerprint",
    "compute_shot_render_fingerprint",
    "ProjectStatus",
    "NodeStatus",
    "FeedbackMode",
    "PlanActionType",
    "CostType",
    "ShotItem",
    "ScriptOutput",
    "NodeFeedbackRequest",
    "PlanAction",
    "ExecutionPlan",
    "ProjectCreateRequest",
]
