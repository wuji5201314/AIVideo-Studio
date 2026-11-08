"""AIVideo-Studio FastAPI entry point.

Follows Alibaba Coding Guidelines:
- Global exception handlers formatting all errors into ResultEnvelope
- 5-digit Alibaba error codes
- File length <= 250 lines
"""

from __future__ import annotations

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure all operators are discovered and registered
import operators  # noqa: F401
from controllers import (
    ErrorCode,
    ResultEnvelope,
    StudioBaseError,
    asset_router,
    operator_router,
    workflow_router,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aivideo_studio")

app = FastAPI(
    title="AIVideo-Studio API",
    version="0.1.0",
    description="新一代基于 Fork MoneyPrinterTurbo 的「节点化·可反馈」全能 AI 视频创作工作台",
)

# CORS middleware for modern frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StudioBaseError)
async def handle_studio_error(request: Request, exc: StudioBaseError) -> JSONResponse:
    """Handle custom business exceptions with Alibaba error codes."""
    envelope = ResultEnvelope.error(code=exc.code, message=exc.message, data=exc.details)
    return JSONResponse(status_code=400, content=envelope.model_dump())


@app.exception_handler(Exception)
async def handle_general_exception(request: Request, exc: Exception) -> JSONResponse:
    """Handle unhandled server exceptions."""
    logger.exception("Unhandled server exception on %s", request.url.path)
    envelope = ResultEnvelope.error(
        code=ErrorCode.INTERNAL_ERROR,
        message=f"System error: {str(exc)}",
    )
    return JSONResponse(status_code=500, content=envelope.model_dump())


# Mount API routers
app.include_router(workflow_router)
app.include_router(operator_router)
app.include_router(asset_router)


@app.get("/health", response_model=ResultEnvelope[dict])
async def health_check() -> ResultEnvelope[dict]:
    """Health check endpoint."""
    return ResultEnvelope.success({"status": "running", "version": "0.1.0"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)
