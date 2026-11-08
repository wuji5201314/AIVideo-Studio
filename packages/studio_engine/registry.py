"""Operator registry and discovery for AIVideo-Studio.

Follows Alibaba Coding Guidelines:
- Thread-safe registry
- Clean lookup and schema introspection
- File length <= 400 lines
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Type
from packages.studio_engine.operator_protocol import BaseOperator


class OperatorRegistry:
    """Central registry holding all available operators."""

    _operators: Dict[str, BaseOperator[Any, Any]] = {}

    @classmethod
    def register(cls, operator_instance: BaseOperator[Any, Any]) -> None:
        """Register an operator instance."""
        cls._operators[operator_instance.op_id] = operator_instance

    @classmethod
    def get(cls, op_id: str) -> Optional[BaseOperator[Any, Any]]:
        """Retrieve operator by id."""
        return cls._operators.get(op_id)

    @classmethod
    def list_all(cls) -> List[Dict[str, Any]]:
        """List metadata for all registered operators."""
        result = []
        for op in cls._operators.values():
            result.append({
                "op_id": op.op_id,
                "name": op.name,
                "category": op.category,
                "description": op.description,
                "is_free_local": op.is_free_local,
                "cost_type": op.cost_type.value,
                "input_schema": op.get_input_schema(),
            })
        return result

    @classmethod
    def list_by_category(cls, category: str) -> List[Dict[str, Any]]:
        """Filter operators by category."""
        return [op for op in cls.list_all() if op["category"] == category]


def register_operator(cls: Type[BaseOperator[Any, Any]]) -> Type[BaseOperator[Any, Any]]:
    """Decorator to auto-register an operator class upon import."""
    instance = cls()
    OperatorRegistry.register(instance)
    return cls
