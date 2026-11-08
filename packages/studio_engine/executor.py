"""Asynchronous task execution and SSE event streaming for AIVideo-Studio.

Follows Alibaba Coding Guidelines:
- Non-blocking async event bus
- CancellationToken lifecycle management
- File length <= 400 lines
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, Optional, Set
from packages.studio_engine.operator_protocol import CancellationToken
from packages.studio_engine.store import WorkflowStore


class EventBus:
    """Pub/sub event bus supporting real-time Server-Sent Events (SSE)."""

    def __init__(self) -> None:
        self._subscribers: Set[asyncio.Queue[str]] = set()

    async def subscribe(self) -> AsyncGenerator[str, None]:
        """Subscribe to SSE events generator."""
        q: asyncio.Queue[str] = asyncio.Queue()
        self._subscribers.add(q)
        try:
            while True:
                msg = await q.get()
                yield msg
        finally:
            self._subscribers.discard(q)

    async def emit(self, event_type: str, data: Dict[str, Any]) -> None:
        """Broadcast event to all connected clients."""
        payload = {
            "event": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        msg = f"event: {event_type}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
        for q in list(self._subscribers):
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                pass


class WorkflowExecutor:
    """Coordinates async execution of workflow tasks with cancellation tokens."""

    def __init__(self, store: WorkflowStore) -> None:
        self.store = store
        self.event_bus = EventBus()
        self._active_tokens: Dict[str, CancellationToken] = {}

    def create_token(self, job_id: str) -> CancellationToken:
        """Register and return a new cancellation token."""
        token = CancellationToken()
        self._active_tokens[job_id] = token
        return token

    def cancel_job(self, job_id: str) -> bool:
        """Cancel an ongoing job by id."""
        token = self._active_tokens.get(job_id)
        if not token:
            return False
        token.cancel()
        return True

    def remove_job(self, job_id: str) -> None:
        """Remove finished job token."""
        self._active_tokens.pop(job_id, None)

    async def notify_progress(
        self,
        project_id: str,
        node_key: str,
        percent: int,
        message: str = "",
    ) -> None:
        """Emit progress update to SSE listeners."""
        await self.event_bus.emit("progress", {
            "project_id": project_id,
            "node_key": node_key,
            "percent": percent,
            "message": message,
        })
