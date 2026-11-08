"""Workflow and Project DAG routes.

Follows Alibaba Coding Guidelines:
- Thin controller: 0 SQL, 0 FFmpeg commands
- Strict DTO validation and unified ResultEnvelope
- File length <= 250 lines
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from controllers.envelope import ErrorCode, ResultEnvelope, StudioBaseError
from packages.studio_engine.models import (
    ExecutionPlan,
    NodeFeedbackRequest,
    ProjectCreateRequest,
)
from packages.studio_engine.planner import DagPlanner, STANDARD_NODE_ORDER
from packages.studio_engine.store import WorkflowStore

router = APIRouter(prefix="/api/v2/projects", tags=["workflow"])

# In-memory singletons for store and planner (injected via dependencies)
_store = WorkflowStore()
_planner = DagPlanner(_store)


def get_store() -> WorkflowStore:
    return _store


def get_planner() -> DagPlanner:
    return _planner


@router.post("", response_model=ResultEnvelope[Dict[str, Any]])
async def create_project(
    req: ProjectCreateRequest,
    store: WorkflowStore = Depends(get_store),
) -> ResultEnvelope[Dict[str, Any]]:
    """Create project and initialize the standard 12-node DAG."""
    project_id = f"proj_{uuid.uuid4().hex[:8]}"
    store.create_project(project_id, req.title, req.brief, req.global_config)

    # Initialize standard nodes
    for idx, node_key in enumerate(STANDARD_NODE_ORDER, start=1):
        status = "READY" if idx == 1 else "PENDING"
        store.upsert_node(
            project_id=project_id,
            node_key=node_key,
            node_type=node_key,
            order_no=idx,
            status=status,
            gate_enabled=True,
        )

    return ResultEnvelope.success({"project_id": project_id, "title": req.title})


@router.get("", response_model=ResultEnvelope[List[Dict[str, Any]]])
async def list_projects(
    limit: int = Query(50, ge=1, le=100),
    store: WorkflowStore = Depends(get_store),
) -> ResultEnvelope[List[Dict[str, Any]]]:
    """List recent projects."""
    projects = store.list_projects(limit=limit)
    return ResultEnvelope.success(projects)


@router.get("/{project_id}", response_model=ResultEnvelope[Dict[str, Any]])
async def get_project_dag(
    project_id: str,
    store: WorkflowStore = Depends(get_store),
) -> ResultEnvelope[Dict[str, Any]]:
    """Retrieve full project details with all DAG nodes."""
    proj = store.get_project(project_id)
    if not proj:
        raise StudioBaseError(ErrorCode.NOT_FOUND, f"Project {project_id} not found")

    nodes = store.get_nodes(project_id)
    return ResultEnvelope.success({"project": proj, "nodes": nodes})


@router.patch("/{project_id}/nodes/{node_key}/config", response_model=ResultEnvelope[Dict[str, Any]])
async def update_node_config(
    project_id: str,
    node_key: str,
    payload: Dict[str, Any],
    store: WorkflowStore = Depends(get_store),
    planner: DagPlanner = Depends(get_planner),
) -> ResultEnvelope[Dict[str, Any]]:
    """Update node configuration and mark affected downstream as STALE."""
    node = store.get_node(project_id, node_key)
    if not node:
        raise StudioBaseError(ErrorCode.NOT_FOUND, f"Node {node_key} not found")

    store.upsert_node(
        project_id=project_id,
        node_key=node_key,
        node_type=node["node_type"],
        order_no=node["order_no"],
        status=node["status"],
        gate_enabled=payload.get("gate_enabled", bool(node["gate_enabled"])),
        config=payload.get("config", {}),
        locked=payload.get("locked", bool(node["locked"])),
    )

    stale_keys = planner.propagate_stale(project_id, node_key)
    return ResultEnvelope.success({"node_key": node_key, "stale_downstream": stale_keys})


@router.post("/{project_id}/nodes/{node_key}/feedback", response_model=ResultEnvelope[Dict[str, Any]])
async def submit_feedback(
    project_id: str,
    node_key: str,
    feedback: NodeFeedbackRequest,
    store: WorkflowStore = Depends(get_store),
    planner: DagPlanner = Depends(get_planner),
) -> ResultEnvelope[Dict[str, Any]]:
    """Submit node feedback and log audit record."""
    node = store.get_node(project_id, node_key)
    if not node:
        raise StudioBaseError(ErrorCode.NOT_FOUND, f"Node {node_key} not found")

    fb_id = f"fb_{uuid.uuid4().hex[:8]}"
    store.add_feedback(
        feedback_id=fb_id,
        project_id=project_id,
        node_key=node_key,
        base_rev_id=feedback.base_rev_id,
        mode=feedback.mode.value,
        instruction=feedback.instruction,
        locked_keys=feedback.locked_keys,
        patches=feedback.manual_patches,
        param_overrides=feedback.param_overrides,
    )

    plan = planner.plan_feedback(project_id, node_key, feedback)
    return ResultEnvelope.success({"feedback_id": fb_id, "plan": plan.model_dump()})


@router.get("/{project_id}/plan", response_model=ResultEnvelope[Dict[str, Any]])
async def preview_plan(
    project_id: str,
    node_key: str = Query("N03_SCRIPT"),
    rev_id: str = Query(...),
    planner: DagPlanner = Depends(get_planner),
) -> ResultEnvelope[Dict[str, Any]]:
    """Preview dry-run impact without executing."""
    fb = NodeFeedbackRequest(base_rev_id=rev_id, mode="REFINE", instruction="preview")
    plan = planner.plan_feedback(project_id, node_key, fb)
    return ResultEnvelope.success(plan.model_dump())
