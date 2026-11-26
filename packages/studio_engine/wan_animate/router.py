"""Multi-backend router for Wan2.2-Animate with health probing and low-spec fallback.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- File <= 200 lines, Function <= 80 lines
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional

from packages.studio_engine.settings_store import AvatarEngineSettings, SettingsStore
from packages.studio_engine.wan_animate.base import (
    BackendHealth,
    BaseWanAnimateBackend,
    ProgressCallback,
    WanAnimateRequest,
    WanAnimateResult,
)
from packages.studio_engine.wan_animate.comfyui_client import ComfyUIWanAnimateBackend
from packages.studio_engine.wan_animate.dashscope_client import DashScopeWanAnimateBackend
from packages.studio_engine.wan_animate.lightweight_swap import LightweightLocalSwapBackend
from packages.studio_engine.wan_animate.wan_worker_client import WanWorkerBackend


class WanAnimateRouter:
    """Routes Wan2.2-Animate inference across ComfyUI, GPU Worker, DashScope, and Local Swap."""

    def __init__(self, settings: Optional[AvatarEngineSettings] = None) -> None:
        self.settings = settings or SettingsStore().get_avatar_settings()
        self.local_backend = LightweightLocalSwapBackend()
        self.backends: Dict[str, BaseWanAnimateBackend] = {
            "comfyui": ComfyUIWanAnimateBackend(self.settings.comfyui_url),
            "wan_worker": WanWorkerBackend(self.settings.wan_worker_url),
            "dashscope": DashScopeWanAnimateBackend(
                api_key=self.settings.dashscope_api_key,
                base_url=self.settings.dashscope_base_url,
            ),
            "local_fallback": self.local_backend,
        }

    def probe_all(self) -> List[BackendHealth]:
        """Probe all Wan2.2-Animate backends concurrently plus local low-spec engine."""
        order = ("comfyui", "wan_worker", "dashscope", "local_fallback")
        with ThreadPoolExecutor(max_workers=4) as pool:
            futs = [pool.submit(self.backends[k].check_health, 0.8) for k in order]
            return [f.result() for f in futs]

    def select_backend(self, preferred: Optional[str] = None) -> BaseWanAnimateBackend:
        """Pick the best available backend according to user preference or auto priority."""
        choice = (preferred or self.settings.active_backend or "auto").strip().lower()
        if choice in self.backends:
            backend = self.backends[choice]
            if choice == "local_fallback" or backend.check_health(timeout=2.0).available:
                return backend
            return self.local_backend

        # Auto priority: open-source ComfyUI -> official Wan Worker -> DashScope API -> local low-spec
        for bid in ("comfyui", "wan_worker", "dashscope"):
            backend = self.backends[bid]
            if backend.check_health(timeout=1.5).available:
                return backend
        return self.local_backend

    def generate(
        self,
        req: WanAnimateRequest,
        preferred_backend: Optional[str] = None,
        on_progress: Optional[ProgressCallback] = None,
    ) -> WanAnimateResult:
        """Execute character replacement/animation on selected backend with safe fallback."""
        backend = self.select_backend(preferred_backend)
        return backend.generate(req, on_progress=on_progress)
