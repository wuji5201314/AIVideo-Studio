# AGENT.md — AI 视频创作工作台（V2）工程架构与阿里巴巴编码规范守则

> **文件定位**：本文件是项目最高优先级的工程与编码宪章。任何开发者或 AI Agent 在本仓库中新增、修改或重构任何前后端代码时，**必须 100% 遵守本规范**。违反任意【强制】条款的代码一律视为不合格。
> **规范基准**：参照《阿里巴巴开发手册（泰山版/嵩山版）》工程规约，结合 Python (FastAPI/Pydantic) 与 TypeScript (React/shadcn/Tailwind) 现代工程实践定制。

---

## 一、 架构分层与解耦规约（反巨石 · 反耦合）

### 1.1 【强制】四层单向依赖架构
后端工程严格划分为四层，**只允许上层单向调用下层，严禁逆向调用、跨层调用或循环依赖**：

```text
[1. API 网关层 (controllers/)]
        ↓  (仅传递 Pydantic Request/Response DTO)
[2. 工作流与编排层 (studio_engine/)]
        ↓  (通过 OperatorProtocol 标准接口调度，不感知具体供应商)
[3. 原子算子插件层 (operators/)]
        ↓  (按需懒加载底层客户端)
[4. 基础设施与 MPT 适配层 (infra/ & mpt_core/)]
```

1. **API 网关层 (`controllers/`)**：仅负责路由映射、参数校验、统一响应包装与异常捕获。**【强制】单个 Controller 文件不得超过 250 行，禁止出现任何 SQL 语句、Prompt 拼接或 FFmpeg 命令。**
2. **工作流编排层 (`studio_engine/`)**：负责 6 阶段 DAG 状态流转、镜头级 SHA256 指纹计算 (`fingerprint.py`)、增量反馈处理 (`APPROVE / PATCH / REFINE / REGENERATE`) 与版本回滚。**【强制】编排层只依赖 `BaseOperator` 抽象接口，严禁直接 `import` 任何第三方 SDK（如 `edge_tts`、`openai`、`moviepy`）。**
3. **原子算子插件层 (`operators/`)**：每一个创作能力（如分镜脚本、10s声音克隆、本机文字动画、口播切气口、单镜合成）都是一个实现了 `BaseOperator[InDTO, OutDTO]` 的独立插件类。**【强制】算子必须无状态（Stateless）、纯函数化，所需配置全部由 `InDTO` 显式传入，严禁读取或修改全局可变字典（如旧版 MPT 的 `config.app`）。**
4. **基础设施层 (`infra/` & `mpt_core/`)**：封装 SQLite 事务、SHA256 内容寻址文件池（CAS）、FFmpeg 进程安全执行器及 MPT 原生服务适配。

### 1.2 【强制】代码体量与复杂度红线（彻底杜绝 3000 行巨型文件）
- **单文件行数上限**：Python `.py` 文件与前端 `.tsx/.ts` 文件**严格控制在 400 行以内**（含注释）。超过 400 行必须按职责拆分为子模块。
- **单函数行数上限**：单个函数/方法**不得超过 80 行**；超过时必须提取语义清晰的私有辅助函数。
- **圈复杂度与嵌套深度**：`if / for / while / try` 的嵌套层数**不得超过 3 层**。必须优先使用**卫语句（Guard Clauses）**提前 `return` 或抛出异常。
- **重型依赖懒加载**：凡涉及 `faster_whisper`、`torch`、`cv2`、`moviepy` 等重型库的导入，**必须在算子 `execute()` 方法内部延迟导入（Lazy Import）**，确保主服务启动时间 `< 1.5s`。

---

## 二、 命名规约（Alibaba Naming Conventions）

### 2.1 【强制】通用命名原则
1. 所有命名必须使用**标准英文单词**，严禁使用拼音、拼音与英文混杂（专有名词如 `douyin`、`xiaohongshu` 除外）或无意义的字母缩写（如 `a1`, `tmp2`, `do_it`）。
2. **布尔值命名**：
   - Python 变量/字段统一加前缀：`is_locked`, `has_audio`, `can_reuse`, `enable_gate`。
   - TypeScript/React Props 统一加前缀：`isLocked`, `isLoading`, `hasSubtitles`, `onApprove`。
3. **常量命名**：全大写蛇形 `UPPER_SNAKE_CASE`（如 `MAX_SHOT_COUNT = 15`, `DEFAULT_SILENCE_DB = -32`），严禁在业务逻辑中直接出现未命名的魔法数字（Magic Numbers）或硬编码字符串。

### 2.2 【强制】Python 后端命名规范
- **包名与模块名**：全小写蛇形 `snake_case`（如 `voice_clone_op.py`, `revision_store.py`）。
- **类名 / Pydantic 模型 / 枚举**：大驼峰 `PascalCase`。
  - 数据传输对象必须带明确后缀：`*Request`, `*Response`, `*Spec`, `*Config`, `*Result`（如 `ShotRefineRequest`, `OperatorPlanResult`）。
  - 异常类必须以 `Error` 结尾（如 `OperatorExecutionError`, `AssetIntegrityError`）。
- **函数名 / 方法名 / 变量名**：小写蛇形 `snake_case`，动词开头（如 `compute_node_fingerprint()`, ` build_refine_prompt()`, `resolve_cas_path()`）。

### 2.3 【强制】前端 TypeScript / React 命名规范
- **组件文件与组件名**：大驼峰 `PascalCase.tsx`（如 `ShotMatrixCard.tsx`, `FeedbackPopover.tsx`）。
- **Hooks 文件与函数**：以 `use` 开头的小驼峰 `useWorkflowPlan.ts`, `useSseProgress.ts`。
- **类型与接口**：大驼峰 `PascalCase`，不使用 `I` 前缀（如 `interface NodeRevision`, `type FeedbackMode = 'APPROVE' | 'PATCH' | 'REFINE' | 'REGENERATE'`）。**【强制】全工程开启 `strict: true`，严禁使用 `any` 类型！**

---

## 三、 错误码与异常处理规约（阿里五位错误码体系）

### 3.1 【强制】统一 API 响应信封（Envelope）
所有 `/api/v2/*` 接口（文件流下载与 SSE 除外）必须返回统一的 JSON 结构：

```json
{
  "code": "00000",
  "message": "ok",
  "data": { ... },
  "request_id": "req_8f92a1c4"
}
```

### 3.2 【强制】阿里标准五位错误码分类
1. **`00000`**：一切正常。
2. **`Axxxx`（用户端/调用方错误，HTTP 400/404/409/422）**：
   - `A0400`：请求参数格式错误或必填项缺失。
   - `A0404`：请求的项目、节点、版本 (`rev_id`) 或资产不存在。
   - `A0409`：节点当前处于 `RUNNING` 状态或镜头已被 `locked`，拒绝并发覆盖修改。
   - `A0422`：不合法的状态机流转（例如对尚未产出的节点执行 `APPROVE`）。
3. **`Bxxxx`（本系统内部执行错误，HTTP 500）**：
   - `B0100`：工作流引擎内部未知异常。
   - `B0201`：本机 FFmpeg / FFprobe 执行失败或命令超时。
   - `B0202`：CAS 内容寻址文件哈希校验不匹配（文件损坏）。
   - `B0301`：SQLite 数据库事务写入失败。
4. **`Cxxxx`（第三方服务/外部模型错误，HTTP 502/503/504）**：
   - `C0101`：第三方 LLM（DeepSeek / Qwen / OpenAI）调用失败或配额不足。
   - `C0102`：第三方 TTS / 声音克隆服务（VoxCPM / FishAudio / MiniMax）超时或异常。
   - `C0103`：第三方生图/生视频服务（Flux / Seedance / Pexels）调用失败。

### 3.3 【强制】异常处理红线
- **严禁静默吞异常**：禁止出现空的 `except Exception: pass`！如果采用降级策略（如云端 TTS 失败回退本地 Edge-TTS），必须使用 `logger.warning("...", exc_info=True)` 记录完整上下文，并在返回结果的 `warnings[]` 字段中明确告知前端，绝不能让用户误以为高阶模型生效了。
- **自定义业务异常**：所有可预期的业务中断必须抛出继承自 `StudioBaseError(code, message, details)` 的异常，由顶层 FastAPI ExceptionHandler 统一拦截转换为标准 JSON 响应。

---

## 四、 数据库、文件存储与并发安全规约

### 4.1 【强制】不可变版本与原子文件写入
1. **产物版本只增不改（Append-Only Revisions）**：在 `wf_node_revisions` 表中，任何一次生成、手改（`PATCH`）或反馈微调（`REFINE`）都必须 `INSERT` 一条新的 `rev_id` 记录，并指向 `parent_rev_id`，**严禁 `UPDATE` 覆盖历史版本的 `output_json`**。
2. **原子文件落盘（Atomic File Write）**：所有音频、图片、单镜视频、字幕写入磁盘时，**必须先写入同目录的临时文件（`.tmp-*`），刷新缓冲区（`flush` + `os.fsync`）并校验非空后，再用 `os.replace()` 原子重命名为最终文件（或按 SHA256 移入 `assets/` 池）**，并在 `finally` 块中清理残留临时文件。
3. **路径安全校验**：所有接收前端传入的文件名或路径参数，必须通过 `Path.resolve()` 校验其父目录严格位于允许的工作区目录内，**严防 `../` 目录穿越攻击**。

### 4.2 【强制】外部进程与长任务超时控制
1. **FFmpeg 安全调用**：一律使用参数列表 `subprocess.run(["ffmpeg", ...], shell=False, timeout=...)` 调用，**严禁拼接字符串后使用 `shell=True`**（防命令注入）；必须禁用网络协议 `-protocols file,pipe`。
2. **可取消令牌（CancellationToken）**：所有耗时 > 2 秒的算子必须接收 `cancel_token`，在分镜循环或流式读取间隙检查 `cancel_token.is_cancelled()`，支持用户在前端随时中止任务并保留已完成的单镜缓存。

---

## 五、 前端开发与 Apple 风格 UI 规约

### 5.1 【强制】组件库与样式使用规范（遵循 `recommended-repos.md`）
1. **标准组件栈**：
   - 基础 UI 与布局统一使用 **`shadcn/ui`** + **`Radix UI`**（源码位于 `src/components/ui/`）。
   - 样式统一使用 **`Tailwind CSS`** 语义化类名。
   - 成片审阅、字幕轨道对齐、音频切气口波形预览统一使用 **`Vidstack`** (`@vidstack/react`)；网格缩略图预览使用轻量原生 `<video muted preload="metadata">`。
2. **Apple 视觉风格约束（Clean Modern Ledger）**：
   - 严格使用 `globals.css` 定义的语义化颜色变量（`bg-canvas` `#FAFAFA`、`bg-surface` `#FFFFFF`、`text-ink` `#171717`、`border-hairline` `#EBEBEB`、`text-apple-blue` `#0071e3`）。
   - **严禁**在业务组件中写内联 `style={{ ... }}`（动态计算宽高/坐标除外），**严禁**使用高饱和荧光渐变背景或刺眼的粗边框。
3. **组件解耦与 Schema 驱动**：
   - 单个 React 组件文件不超过 300 行；数据请求与状态逻辑必须抽离到自定义 Hook（`use*.ts`）或 `services/api.ts`，**严禁在 JSX 事件回调里直接写裸 `fetch()`**。

---

## 六、 代码提交与自检清单（Agent Pre-Commit Checklist）

每次完成一个模块或算子的编写后，必须逐项核对以下清单方可提交：
- [ ] 1. 是否有任何文件超过 400 行、任何函数超过 80 行？
- [ ] 2. 算子是否做到了纯函数输入输出（未读写全局 `config.app`）？
- [ ] 3. 节点修改后，字段级 SHA256 指纹是否正确保证了「未修改镜头 100% 命中缓存不重跑」？
- [ ] 4. 锁定的镜头（`locked_keys`）在经过大模型 `REFINE` 后，是否有代码层兜底强制原字保留？
- [ ] 5. 外部 API 或 FFmpeg 调用是否都有 `timeout`、原子写入和五位错误码捕获？
- [ ] 6. 前端是否完全使用了 TypeScript 强类型（0 个 `any`）与 Apple 风格语义 Token？
