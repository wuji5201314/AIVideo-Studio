# AIVideo-Studio (新一代节点化·可反馈 AI 视频创作工作台)

> **基于 Fork MoneyPrinterTurbo 的微内核二次开发重构版**
> 
> 彻底抛弃传统 AI 视频工具「填参数 → 黑盒流水线一口气跑完 → 不满意整条推翻」的痛点，构建 **6 阶段宏观 DAG + 镜头级 SHA256 内容寻址缓存 + 锁镜增量反馈 (REFINE)** 引擎，实现「任意环节可见可调、按句调音、按镜换图、秒级换 BGM 混音导出」。

---

## 🌟 核心特色与设计原则

1. **一切皆节点（Everything is a Node）**：
   - 选题、分镜、配音、画面、单镜合成、字幕与混音导出全部抽象为标准原子算子。
   - 单点工具（如 10s 声音克隆、口播智能切气口、文字动画卡）与视频工作台共享同一套底层算子，产物沉淀进统一素材库。
2. **字段级 SHA256 指纹缓存（Fingerprint Cache）**：
   - 下游节点只订阅上游产物的特定字段。修改第 2 镜台词，第 1、3、4 镜配音/画面零计算复用；修改视频标题或更换 BGM，视频画面零重渲。
3. **四种标准化反馈动作（Feedback Actions）**：
   - `APPROVE`：冻结当前版本，通过 Gate 进入下游。
   - `PATCH`：用户直接手改字段，0 API 消耗直接落盘新版本。
   - `REFINE`：带 `locked_keys` 保护的自然语言增量微调，模型只修改未锁定镜头，代码层兜底强制保留锁定镜头。
   - `REGENERATE`：局部重抽卡，仅重算未锁定项。
4. **版本树与秒级回滚（Append-Only Revisions）**：
   - 每次生成与修改均追加新版本（v1 -> v2 -> v3），历史产物由 CAS（内容寻址池）妥善保存，支持秒级回滚与双版本 Diff 对比。
5. **Apple 风格视觉体系（Clean Modern Ledger）**：
   - 浅灰画布 `#FAFAFA` + 纯白微阴影圆角卡片 + 1px 极细线 + Apple 蓝 `#0071e3`。
   - 采用 React + Tailwind CSS + shadcn/ui + Radix UI + Vidstack 打造桌面级丝滑体验。

---

## 🏛️ 系统架构 (Microkernel + Operator Plugin)

```text
AIVideo-Studio/
├── packages/
│   ├── studio_engine/         # 【核心微内核】DAG 编排、SQLite 5张版本表、指纹比对、增量反馈
│   └── mpt_core/              # 【MPT 提纯适配层】LLM、TTS、素材与 VideoProject 服务
├── operators/                 # 【可插拔算子插件库】纯函数无状态算子（Script, Voice, Visual, Motion...）
├── controllers/               # 【统一薄网关层】REST API + SSE 进度流 + 阿里 5 位标准错误码
├── storage/                   # SQLite workflow.db 与 SHA256 CAS 资产池 (assets/)
├── studio-web/                # 【现代前端】React + TS + Tailwind + shadcn/ui + Vidstack
├── AGENT.md                   # 阿里巴巴开发手册工程规约与质量红线
└── pyproject.toml             # Python 依赖与构建配置
```

---

## 🚀 快速启动

```bash
# 1. 安装后端依赖
pip install -r requirements.txt

# 2. 启动核心服务
python -m uvicorn main:app --host 0.0.0.0 --port 8010 --reload
```

---

## 📜 编码规约
本项目严格遵循 `AGENT.md`（《阿里巴巴开发规约》标准）：
- 单文件行数 ≤ 400 行，单函数行数 ≤ 80 行，圈复杂度 ≤ 3。
- 统一返回 `Result<T>` 信封与 5 位错误码体系（`00000`, `A04xx`, `B01xx`, `C01xx`）。
- 外部调用与 FFmpeg 必须设置 timeout 并支持 CancellationToken 取消。
- 产物版本不可变（Append-Only），落盘必须原子写入（Atomic Write）。
