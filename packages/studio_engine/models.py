"""Data Transfer Objects and Enums for AIVideo-Studio Workflow.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- Pydantic models with clear prefixes/suffixes
- File length <= 400 lines
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProjectStatus(str, Enum):
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    WAITING_GATE = "WAITING_GATE"
    DONE = "DONE"
    FAILED = "FAILED"


class NodeStatus(str, Enum):
    PENDING = "PENDING"
    READY = "READY"
    RUNNING = "RUNNING"
    WAITING_GATE = "WAITING_GATE"
    SUCCEEDED = "SUCCEEDED"
    STALE = "STALE"
    FAILED = "FAILED"


class FeedbackMode(str, Enum):
    APPROVE = "APPROVE"
    PATCH = "PATCH"
    REFINE = "REFINE"
    REGENERATE = "REGENERATE"
    ROLLBACK = "ROLLBACK"


class PlanActionType(str, Enum):
    REUSE = "REUSE"
    BUILD = "BUILD"
    REFINE = "REFINE"
    PATCH = "PATCH"


class CostType(str, Enum):
    NONE = "none"
    LLM = "llm"
    TTS = "tts"
    IMAGE_GEN = "image_gen"
    VIDEO_GEN = "video_gen"
    FFMPEG = "ffmpeg"


class ShotItem(BaseModel):
    """Represents a single shot within a script."""

    shot_id: str = Field(description="Unique shot identifier, e.g. shot_01")
    headline: str = Field(default="", description="Visual headline or keyword")
    narration: str = Field(description="Voiceover narration speech text")
    visual_prompt: str = Field(description="AI image or video generation prompt")
    search_terms: List[str] = Field(default_factory=list, description="Stock footage terms")
    est_duration: float = Field(default=3.5, description="Estimated duration in seconds")
    is_locked: bool = Field(default=False, description="Whether locked against model rewrite")
    audio_path: Optional[str] = Field(default=None, description="Local or CAS path to synthesized audio")
    visual_path: Optional[str] = Field(default=None, description="Selected image or video clip path")
    clip_path: Optional[str] = Field(default=None, description="Rendered scene video clip path")


class ScriptOutput(BaseModel):
    """Output schema for N03_SCRIPT stage."""

    title: str = Field(default="未命名视频", description="Video title")
    summary: str = Field(default="", description="Brief story summary")
    tags: List[str] = Field(default_factory=list, description="Hashtags for social publishing")
    shots: List[ShotItem] = Field(default_factory=list, description="Array of shots")


class NodeFeedbackRequest(BaseModel):
    """Payload submitted when user provides feedback on a node."""

    base_rev_id: str = Field(description="Revision id this feedback is based upon")
    mode: FeedbackMode = Field(description="APPROVE, PATCH, REFINE, REGENERATE, ROLLBACK")
    instruction: str = Field(default="", description="Natural language refinement prompt")
    locked_keys: List[str] = Field(default_factory=list, description="Keys/shot_ids to protect")
    manual_patches: Dict[str, Any] = Field(default_factory=dict, description="Direct field edits")
    param_overrides: Dict[str, Any] = Field(default_factory=dict, description="Node param overrides")


class PlanAction(BaseModel):
    """A planned execution step in the dry-run plan."""

    node_key: str
    action: PlanActionType
    reason: str
    cost_type: CostType
    affected_shot_ids: List[str] = Field(default_factory=list)


class ExecutionPlan(BaseModel):
    """Dry-run impact preview returned before actual execution."""

    project_id: str
    base_revision: str
    actions: List[PlanAction]
    estimated_reuse_count: int
    estimated_build_count: int


class ProjectCreateRequest(BaseModel):
    """Request payload to create a new video project."""

    title: str = Field(description="Project title")
    brief: str = Field(description="User prompt, core idea, or topic")
    preset: str = Field(default="standard_12_nodes", description="Workflow preset template")
    global_config: Dict[str, Any] = Field(default_factory=dict, description="Aspect, language, etc.")
