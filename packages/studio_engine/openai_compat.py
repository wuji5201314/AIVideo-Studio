"""Universal OpenAI-compatible HTTP client for LLM, Image, and Video generation.

Works with SiliconFlow, DeepSeek, OneAPI / NewAPI relays, DashScope compatible mode,
OpenRouter, and OpenAI directly — zero extra SDK dependency required.

Follows Alibaba Coding Guidelines:
- Strict typing, 0 any
- File <= 280 lines, Function <= 80 lines
"""

from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from packages.studio_engine.settings_store import CloudApiSettings, SettingsStore


class OpenAICompatClient:
    """Thin, reliable stdlib client for OpenAI-compatible cloud model endpoints."""

    def __init__(self, settings: Optional[CloudApiSettings] = None) -> None:
        self.settings = settings or SettingsStore().get_cloud_api_settings()

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 45.0,
    ) -> str:
        """Call POST {base_url}/chat/completions and return assistant text."""
        base_url, api_key, model = self.settings.resolve("llm")
        if not api_key:
            raise RuntimeError("尚未配置文本大模型 API Key，请先点击左侧「API 模型配置」填入您的 Key。")

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        data = self._post_json(f"{base_url}/chat/completions", api_key, payload, timeout=timeout)
        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError(f"LLM 返回为空: {data}")
        msg = choices[0].get("message") or {}
        content = msg.get("content") or ""
        return str(content).strip()

    def generate_image(
        self,
        prompt: str,
        output_dir: Path,
        size: str = "1024x1024",
        timeout: float = 90.0,
    ) -> Path:
        """Call POST {base_url}/images/generations and save resulting PNG/JPG locally."""
        base_url, api_key, model = self.settings.resolve("image")
        if not api_key:
            raise RuntimeError("尚未配置生图模型 API Key，请先点击左侧「API 模型配置」填入 Key。")

        payload: Dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "image_size": size,
            "size": size,
            "n": 1,
        }
        data = self._post_json(f"{base_url}/images/generations", api_key, payload, timeout=timeout)
        items = data.get("data") or data.get("images") or []
        if not items:
            raise RuntimeError(f"生图 API 未返回图片数据: {data}")

        first = items[0]
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / f"ai-img-{uuid.uuid4().hex[:8]}.png"

        if isinstance(first, dict) and first.get("b64_json"):
            out_path.write_bytes(base64.b64decode(first["b64_json"]))
            return out_path

        img_url = first.get("url") if isinstance(first, dict) else str(first)
        if not img_url or not str(img_url).startswith("http"):
            raise RuntimeError(f"生图 API 返回的图片地址无效: {first}")

        req = urllib.request.Request(str(img_url), headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60.0) as resp:
            out_path.write_bytes(resp.read())
        return out_path

    def generate_video(
        self,
        prompt: str,
        output_dir: Path,
        image_path: Optional[str] = None,
        aspect_ratio: str = "9:16",
        timeout_sec: float = 300.0,
    ) -> Path:
        """Call OpenAI-compatible / SiliconFlow / OneAPI video generation endpoint and save MP4."""
        base_url, api_key, model = self.settings.resolve("video")
        if not api_key:
            raise RuntimeError("尚未配置视频生成 API Key，请先点击左侧「API 模型配置」填入 Key。")

        image_size = "720x1280" if aspect_ratio == "9:16" else "1280x720"
        payload: Dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "image_size": image_size,
            "aspect_ratio": aspect_ratio,
        }
        if image_path and Path(image_path).is_file():
            raw = Path(image_path).read_bytes()
            ext = Path(image_path).suffix.lower().lstrip(".") or "png"
            mime = "jpeg" if ext in ("jpg", "jpeg") else ext
            payload["image"] = f"data:image/{mime};base64,{base64.b64encode(raw).decode('ascii')}"
            payload["image_url"] = payload["image"]

        is_sf = "siliconflow" in base_url.lower()
        submit_url = f"{base_url}/video/submit" if is_sf else f"{base_url}/videos/generations"
        data = self._post_json(submit_url, api_key, payload, timeout=60.0)

        direct_url = self._extract_video_url(data)
        if direct_url:
            return self._download_video(direct_url, output_dir)

        req_id = data.get("requestId") or data.get("id") or data.get("task_id") or (data.get("output") or {}).get("task_id")
        if not req_id:
            raise RuntimeError(f"视频生成 API 返回未知格式: {data}")

        video_url = self._poll_video_status(base_url, api_key, str(req_id), is_sf, timeout_sec)
        return self._download_video(video_url, output_dir)

    def test_llm_connection(self) -> Dict[str, Any]:
        """Verify LLM endpoint connectivity and return latency + sample reply."""
        t0 = time.time()
        base_url, api_key, model = self.settings.resolve("llm")
        if not api_key:
            return {"ok": False, "message": "未填写 API Key", "latency_ms": 0}
        try:
            reply = self.chat_completion(
                messages=[{"role": "user", "content": "回复 OK 两个字母即可"}],
                temperature=0.0,
                max_tokens=16,
                timeout=15.0,
            )
            return {
                "ok": True,
                "message": f"连接成功！模型 {model} 返回：{reply[:40]}",
                "latency_ms": int((time.time() - t0) * 1000),
            }
        except Exception as exc:
            return {
                "ok": False,
                "message": f"连接失败：{exc}",
                "latency_ms": int((time.time() - t0) * 1000),
            }

    def _poll_video_status(
        self,
        base_url: str,
        api_key: str,
        request_id: str,
        is_siliconflow: bool,
        timeout_sec: float,
    ) -> str:
        start = time.time()
        while time.time() - start < timeout_sec:
            if is_siliconflow:
                res = self._post_json(f"{base_url}/video/status", api_key, {"requestId": request_id}, timeout=20.0)
            else:
                res = self._get_json(f"{base_url}/videos/generations/{request_id}", api_key, timeout=20.0)

            url = self._extract_video_url(res)
            if url:
                return url
            status = str(res.get("status") or (res.get("output") or {}).get("task_status") or "").upper()
            if status in ("FAILED", "ERROR", "CANCELED"):
                raise RuntimeError(f"云端视频生成失败: {res.get('reason') or res.get('message') or res}")
            time.sleep(4.0)
        raise TimeoutError(f"云端视频生成超时 ({timeout_sec}s)")

    @staticmethod
    def _extract_video_url(data: Dict[str, Any]) -> str:
        for key in ("video_url", "url"):
            val = data.get(key)
            if isinstance(val, str) and val.startswith("http"):
                return val
        results = data.get("results") or data.get("data") or {}
        if isinstance(results, dict):
            vids = results.get("videos") or []
            if vids and isinstance(vids[0], dict) and vids[0].get("url"):
                return str(vids[0]["url"])
            if isinstance(results.get("video_url"), str):
                return results["video_url"]
        if isinstance(results, list) and results and isinstance(results[0], dict):
            u = results[0].get("url") or results[0].get("video_url")
            if isinstance(u, str) and u.startswith("http"):
                return u
        return ""

    @staticmethod
    def _download_video(url: str, output_dir: Path) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        out = output_dir / f"ai-vid-{uuid.uuid4().hex[:8]}.mp4"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120.0) as resp:
            out.write_bytes(resp.read())
        return out

    @staticmethod
    def _post_json(url: str, api_key: str, payload: Dict[str, Any], timeout: float = 45.0) -> Dict[str, Any]:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8", errors="replace"))
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")[:300]
            raise RuntimeError(f"HTTP {exc.code}: {err_body}") from exc

    @staticmethod
    def _get_json(url: str, api_key: str, timeout: float = 20.0) -> Dict[str, Any]:
        req = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
