"""Unified Result Envelope and Alibaba 5-digit error codes.

Follows Alibaba Coding Guidelines:
- Standard 5-digit error classification (00000, Axxxx, Bxxxx, Cxxxx)
- Unified Result<T> envelope with request_id tracking
- File length <= 400 lines
"""

from __future__ import annotations

import uuid
from typing import Any, Generic, Optional, TypeVar
from pydantic import BaseModel, Field


class ErrorCode:
    """Standard Alibaba 5-digit error codes."""
    SUCCESS = "00000"

    # Axxxx: Client/Parameter errors
    BAD_REQUEST = "A0400"
    NOT_FOUND = "A0404"
    STATE_CONFLICT = "A0409"
    INVALID_STATE_TRANSITION = "A0422"

    # Bxxxx: System internal execution errors
    INTERNAL_ERROR = "B0100"
    FFMPEG_ERROR = "B0201"
    STORAGE_CORRUPTED = "B0202"
    DATABASE_ERROR = "B0301"

    # Cxxxx: Third-party API errors
    LLM_API_ERROR = "C0101"
    TTS_API_ERROR = "C0102"
    VISUAL_API_ERROR = "C0103"


T = TypeVar("T")


class ResultEnvelope(BaseModel, Generic[T]):
    """Standard response envelope across all API v2 endpoints."""

    code: str = Field(default=ErrorCode.SUCCESS, description="5-digit status code")
    message: str = Field(default="ok", description="Status message")
    data: Optional[T] = Field(default=None, description="Response payload")
    request_id: str = Field(default_factory=lambda: f"req_{uuid.uuid4().hex[:8]}")

    @classmethod
    def success(cls, data: T, message: str = "ok") -> ResultEnvelope[T]:
        """Construct a successful response envelope."""
        return cls(code=ErrorCode.SUCCESS, message=message, data=data)

    @classmethod
    def error(cls, code: str, message: str, data: Optional[T] = None) -> ResultEnvelope[T]:
        """Construct an error response envelope."""
        return cls(code=code, message=message, data=data)


class StudioBaseError(Exception):
    """Base application exception carrying Alibaba 5-digit error code."""

    def __init__(
        self,
        code: str = ErrorCode.INTERNAL_ERROR,
        message: str = "Internal server error",
        details: Optional[Any] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details
