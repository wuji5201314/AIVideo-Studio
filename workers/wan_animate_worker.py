"""Standalone Open-Source GPU Worker for official Wan-Video/Wan2.2-Animate-14B.

Deploy on any Linux/Windows GPU host (RTX 3090/4090/A100):
    export WAN22_REPO=/path/to/Wan2.2
    export WAN22_CKPT=/path/to/Wan2.2-Animate-14B
    uvicorn workers.wan_animate_worker:app --host 0.0.0.0 --port 8390

Follows Alibaba Coding Guidelines:
- Subprocess with list args (no shell=True)
- Strict typing, File <= 250 lines
"""

from __future__ import annotations

import os
import subprocess
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, List
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

app = FastAPI(title="Wan2.2-Animate Open-Source GPU Worker", version="1.0.0")

WAN_REPO = Path(os.environ.get("WAN22_REPO", "/workspace/Wan2.2")).resolve()
WAN_CKPT = Path(os.environ.get("WAN22_CKPT", "/workspace/Wan2.2-Animate-14B")).resolve()
WORK_ROOT = Path(os.environ.get("WAN22_WORK_DIR", "/tmp/wan22_worker_jobs")).resolve()
WORK_ROOT.mkdir(parents=True, exist_ok=True)

TASKS: Dict[str, Dict[str, Any]] = {}


def _detect_gpu() -> str:
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            text=True,
            timeout=5,
        )
        return out.strip().splitlines()[0] if out.strip() else "CPU"
    except Exception:
        return "Unknown GPU"


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "gpu": _detect_gpu(),
        "repo_exists": WAN_REPO.exists(),
        "ckpt_exists": WAN_CKPT.exists(),
    }


@app.post("/tasks")
async def create_task(
    video: UploadFile = File(...),
    character_image: UploadFile = File(...),
    mode: str = Form("replace"),
    resolution: str = Form("720p"),
    use_relighting_lora: str = Form("true"),
    prompt: str = Form(""),
) -> Dict[str, str]:
    task_id = uuid.uuid4().hex[:12]
    job_dir = WORK_ROOT / task_id
    job_dir.mkdir(parents=True, exist_ok=True)

    video_path = job_dir / f"driving{Path(video.filename or 'v.mp4').suffix or '.mp4'}"
    image_path = job_dir / f"character{Path(character_image.filename or 'c.png').suffix or '.png'}"
    video_path.write_bytes(await video.read())
    image_path.write_bytes(await character_image.read())

    TASKS[task_id] = {
        "task_id": task_id,
        "status": "RUNNING",
        "progress": 0.1,
        "message": "任务已排队，准备运行 preprocess_data.py",
        "result_path": "",
        "error": "",
    }
    thread = threading.Thread(
        target=_run_wan_pipeline,
        args=(task_id, job_dir, video_path, image_path, mode, resolution, use_relighting_lora.lower() == "true"),
        daemon=True,
    )
    thread.start()
    return {"task_id": task_id}


@app.get("/tasks/{task_id}")
def get_task(task_id: str) -> Dict[str, Any]:
    task = TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.get("/tasks/{task_id}/result")
def get_result(task_id: str) -> FileResponse:
    task = TASKS.get(task_id)
    if not task or not task.get("result_path") or not os.path.exists(task["result_path"]):
        raise HTTPException(status_code=404, detail="Result not ready")
    return FileResponse(task["result_path"], media_type="video/mp4")


def _run_wan_pipeline(
    task_id: str,
    job_dir: Path,
    video_path: Path,
    image_path: Path,
    mode: str,
    resolution: str,
    use_relighting_lora: bool,
) -> None:
    try:
        proc_dir = job_dir / "process_results"
        proc_dir.mkdir(parents=True, exist_ok=True)
        res_area = ["1280", "720"] if resolution == "720p" else ["832", "480"]

        # Step 1: Official Wan2.2-Animate preprocessing (DWPose + SAM2 mask for replace)
        TASKS[task_id]["progress"] = 0.25
        TASKS[task_id]["message"] = "正在运行 preprocess_data.py（提取骨骼姿态与人物遮罩）..."
        prep_cmd: List[str] = [
            "python",
            str(WAN_REPO / "wan/modules/animate/preprocess/preprocess_data.py"),
            "--ckpt_path",
            str(WAN_CKPT / "process_checkpoint"),
            "--video_path",
            str(video_path),
            "--refer_path",
            str(image_path),
            "--save_path",
            str(proc_dir),
            "--resolution_area",
            *res_area,
        ]
        if mode == "replace":
            prep_cmd += ["--iterations", "3", "--k", "7", "--w_len", "1", "--h_len", "1", "--replace_flag"]
        subprocess.run(prep_cmd, check=True, cwd=str(WAN_REPO), timeout=600)

        # Step 2: Official Wan2.2-Animate-14B generation
        TASKS[task_id]["progress"] = 0.55
        TASKS[task_id]["message"] = "正在运行 generate.py（Wan2.2-Animate-14B 扩散推理）..."
        out_mp4 = job_dir / "wan22_output.mp4"
        gen_cmd: List[str] = [
            "python",
            str(WAN_REPO / "generate.py"),
            "--task",
            "animate-14B",
            "--ckpt_dir",
            str(WAN_CKPT),
            "--src_root_path",
            str(proc_dir),
            "--refert_num",
            "1",
            "--save_file",
            str(out_mp4),
        ]
        if mode == "replace":
            gen_cmd.append("--replace_flag")
            if use_relighting_lora:
                gen_cmd.append("--use_relighting_lora")
        subprocess.run(gen_cmd, check=True, cwd=str(WAN_REPO), timeout=1800)

        TASKS[task_id]["progress"] = 1.0
        TASKS[task_id]["status"] = "SUCCEEDED"
        TASKS[task_id]["message"] = "Wan2.2-Animate-14B 推理完成"
        TASKS[task_id]["result_path"] = str(out_mp4)
    except Exception as exc:
        TASKS[task_id]["status"] = "FAILED"
        TASKS[task_id]["error"] = str(exc)
        TASKS[task_id]["message"] = f"执行失败: {exc}"
