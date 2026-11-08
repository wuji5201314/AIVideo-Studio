"""Base Operator Protocol and CancellationToken for AIVideo-Studio.

Follows Alibaba Coding Guidelines:
- Strict typing, stateless operator execution
- Guard clauses and cancellation tokens
- File length <= 400 lines
"""

from __future__ import annotations

import threading
from abc import ABC, abstractmethod
from typing import Any, Dict, Generic, Optional, TypeVar
from pydantic import BaseModel
from packages.studio_engine.models import CostType


class OperationCancelledError(Exception):
    """Raised when an operation is cancelled by the user."""
    def __init__(self, message: str = "Operation was cancelled by user") -> None:
        super().__init__(message)


class CancellationToken:
    """Thread-safe cancellation token passed to long-running operators."""

    def __init__(self) -> None:
        self._cancelled = threading.Event()

    def cancel(self) -> None:
        """Signal cancellation."""
        self._cancelled.set()

    def is_cancelled(self) -> bool:
        """Check if cancellation has been requested."""
        return self._cancelled.is_set()

    def throw_if_cancelled(self) -> None:
        """Raise OperationCancelledError if cancelled."""
        if self._cancelled.is_set():
            raise OperationCancelledError()


InDTO = TypeVar("InDTO", bound=BaseModel)
OutDTO = TypeVar("OutDTO", bound=BaseModel)


class BaseOperator(ABC, Generic[InDTO, OutDTO]):
    """Abstract Base Class for all single-tool and workflow operators."""

    op_id: str
    name: str
    category: str
    description: str
    is_free_local: bool = True
    cost_type: CostType = CostType.NONE
    input_dto_cls: Optional[type] = None

    @abstractmethod
    async def execute(
        self,
        input_data: InDTO,
        config: Dict[str, Any],
        cancel_token: Optional[CancellationToken] = None,
    ) -> OutDTO:
        """Execute the operator logic in a pure, stateless manner."""
        raise NotImplementedError

    def get_input_schema(self) -> Dict[str, Any]:
        """Return the JSON schema for operator input form rendering."""
        if self.input_dto_cls and hasattr(self.input_dto_cls, "model_json_schema"):
            return self.input_dto_cls.model_json_schema()
        return {}
