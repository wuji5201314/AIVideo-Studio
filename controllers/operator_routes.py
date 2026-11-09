"""Universal Operator Execution Gateway routes.

Follows Alibaba Coding Guidelines:
- Thin controller: dispatches to OperatorRegistry
- Standard Alibaba 5-digit error handling
- File length <= 250 lines
"""

from __future__ import annotations

from typing import Any, Dict, List
from fastapi import APIRouter
from controllers.envelope import ErrorCode, ResultEnvelope, StudioBaseError
from packages.studio_engine.operator_protocol import CancellationToken
from packages.studio_engine.registry import OperatorRegistry

router = APIRouter(prefix="/api/v2/operators", tags=["operators"])


@router.get("", response_model=ResultEnvelope[List[Dict[str, Any]]])
async def list_operators() -> ResultEnvelope[List[Dict[str, Any]]]:
    """List all registered operators with JSON schemas and capability metadata."""
    ops = OperatorRegistry.list_all()
    return ResultEnvelope.success(ops)


@router.get("/heygem/status", response_model=ResultEnvelope[Dict[str, Any]])
async def check_heygem_status() -> ResultEnvelope[Dict[str, Any]]:
    """Probe if local HeyGem (Duix) neural lip-sync engine is online."""
    from packages.studio_engine.heygem_client import HeyGemClient

    client = HeyGemClient()
    available = client.is_available()
    return ResultEnvelope.success({
        "available": available,
        "base_url": client.base_url,
        "mode": "heygem_lipsync" if available else "dynamic_presenter",
        "description": "HeyGem 旗博士神经网络口型引擎已就绪" if available else "本地电影级动态运镜 + 高燃网感字幕就绪",
    })


@router.get("/{op_id}", response_model=ResultEnvelope[Dict[str, Any]])
async def get_operator(op_id: str) -> ResultEnvelope[Dict[str, Any]]:
    """Get metadata for a specific operator."""
    op = OperatorRegistry.get(op_id)
    if not op:
        raise StudioBaseError(ErrorCode.NOT_FOUND, f"Operator {op_id} not found")

    return ResultEnvelope.success({
        "op_id": op.op_id,
        "name": op.name,
        "category": op.category,
        "description": op.description,
        "is_free_local": op.is_free_local,
        "cost_type": op.cost_type.value,
        "input_schema": op.get_input_schema(),
    })


@router.post("/{op_id}/execute", response_model=ResultEnvelope[Any])
async def execute_operator(
    op_id: str,
    payload: Dict[str, Any],
) -> ResultEnvelope[Any]:
    """Execute any registered operator via universal gateway."""
    op = OperatorRegistry.get(op_id)
    if not op:
        raise StudioBaseError(ErrorCode.NOT_FOUND, f"Operator {op_id} not found")

    token = CancellationToken()
    config = payload.get("config", {})
    input_data_raw = payload.get("input", {})

    try:
        # Dynamic Pydantic validation if model class exists
        in_dto_cls = getattr(op, "input_dto_cls", None)
        if in_dto_cls and hasattr(in_dto_cls, "model_validate"):
            validated_input = in_dto_cls.model_validate(input_data_raw)
        else:
            validated_input = input_data_raw

        result = await op.execute(validated_input, config, cancel_token=token)
        result_dict = result.model_dump() if hasattr(result, "model_dump") else result
        return ResultEnvelope.success(result_dict)
    except Exception as exc:
        raise StudioBaseError(ErrorCode.INTERNAL_ERROR, f"Operator execution error: {str(exc)}")
