import React, { useState } from "react";
import {
  Lock,
  Unlock,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import { api } from "../../services/api";
import type { ExecutionPlan, PlanAction, ShotItem } from "../../services/api";

const INITIAL_SHOTS: ShotItem[] = [
  {
    shot_id: "shot_01",
    headline: "黄金前3秒：核心痛点",
    narration: "为什么90%的人剪出来的AI视频，看起来都像PPT幻灯片？",
    visual_prompt: "深夜电脑桌前，剪辑师抓狂面对时间轴的近景特写，屏幕发散微光",
    search_terms: ["video editor", "frustrated", "computer"],
    est_duration: 3.5,
    is_locked: true,
  },
  {
    shot_id: "shot_02",
    headline: "痛点深挖：黑盒盲盒",
    narration: "因为传统工具都是黑盒：改一句话就要整条重录，换张图就要全部推翻。",
    visual_prompt: "机械黑盒齿轮运转，卡顿错位的三维概念动画，冷色调",
    search_terms: ["black box", "gears", "broken workflow"],
    est_duration: 4.2,
    is_locked: false,
  },
  {
    shot_id: "shot_03",
    headline: "解法呈现：节点化思维",
    narration: "你需要的是新一代节点化工作台：按镜锁定、局部增量反馈，不花一分冤枉钱。",
    visual_prompt: "精致发光的节点连接网状图，纯净浅灰背景，极简科技感",
    search_terms: ["nodes network", "modern technology", "clean"],
    est_duration: 3.8,
    is_locked: false,
  },
];

export const WorkflowStudioView: React.FC = () => {
  const [shots, setShots] = useState<ShotItem[]>(INITIAL_SHOTS);
  const [activeStage, setActiveStage] = useState<string>("N03_SCRIPT");
  const [refineInstruction, setRefineInstruction] = useState<string>("");
  const [planPreview, setPlanPreview] = useState<ExecutionPlan | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const toggleShotLock = (shotId: string) => {
    setShots((prev) =>
      prev.map((s) => (s.shot_id === shotId ? { ...s, is_locked: !s.is_locked } : s))
    );
  };

  const handleRefineSubmit = async () => {
    if (!refineInstruction.trim()) return;
    setIsProcessing(true);
    try {
      const lockedKeys = shots.filter((s) => s.is_locked).map((s) => s.shot_id);
      const res = await api.executeOperator<{ shots: ShotItem[] }>(
        "op_script_storyboard",
        {
          prompt: "AI视频节点化工作流",
          shot_count: shots.length,
          base_script: {
            title: "节点化视频爆款指南",
            summary: "分镜脚本",
            tags: ["AI", "短视频"],
            shots: shots,
          },
          refine_instruction: refineInstruction,
          locked_keys: lockedKeys,
        }
      );
      if (res && res.shots) {
        setShots(res.shots);
        setRefineInstruction("");
      }
    } catch (err) {
      console.error("Refine error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreviewPlan = () => {
    const lockedKeys = shots.filter((s) => s.is_locked).map((s) => s.shot_id);
    const actions: PlanAction[] = [
      {
        node_key: "N03_SCRIPT",
        action: "REFINE",
        reason: `增量修改：锁定 ${lockedKeys.join(", ") || "无"}`,
        cost_type: "llm",
        affected_shot_ids: shots.filter((s) => !s.is_locked).map((s) => s.shot_id),
      },
    ];

    shots.forEach((s) => {
      if (s.is_locked) {
        actions.push({
          node_key: `N05_VOICE:${s.shot_id}`,
          action: "REUSE",
          reason: `分镜 ${s.shot_id} 已锁定，零计算复用原音频`,
          cost_type: "none",
          affected_shot_ids: [s.shot_id],
        });
      } else {
        actions.push({
          node_key: `N05_VOICE:${s.shot_id}`,
          action: "BUILD",
          reason: `分镜 ${s.shot_id} 文案变更，重算TTS`,
          cost_type: "tts",
          affected_shot_ids: [s.shot_id],
        });
      }
    });

    const reuseCnt = actions.filter((a) => a.action === "REUSE").length;
    setPlanPreview({
      project_id: "current_project",
      base_revision: "rev_003",
      actions,
      estimated_reuse_count: reuseCnt,
      estimated_build_count: actions.length - reuseCnt,
    });
  };

  return (
    <div className="flex h-full w-full">
      {/* 1. Left DAG Stage Navigation (240px) */}
      <div className="w-60 border-r border-border-subtle bg-surface/50 p-4 shrink-0 flex flex-col justify-between">
        <div>
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
            工作流节点图 (DAG)
          </div>
          <div className="space-y-1.5">
            {[
              { id: "N01_BRIEF", label: "① 项目设定", status: "SUCCEEDED", gate: false },
              { id: "N02_TOPIC", label: "② 选题确认", status: "SUCCEEDED", gate: true },
              { id: "N03_SCRIPT", label: "③ 分镜脚本", status: "SUCCEEDED", gate: true },
              { id: "N05_VOICE", label: "④ 分镜配音", status: "STALE", gate: true },
              { id: "N06_MATERIAL", label: "⑤ 分镜画面", status: "STALE", gate: true },
              { id: "N07_SHOT_RENDER", label: "⑥ 单镜合成", status: "STALE", gate: false },
              { id: "N11_EXPORT", label: "⑦ 混音成片", status: "PENDING", gate: true },
            ].map((node) => {
              const isSelected = activeStage === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => setActiveStage(node.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "border-apple-blue bg-surface shadow-soft"
                      : "border-border-subtle bg-surface/40 hover:bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-ink">{node.label}</span>
                    {node.status === "SUCCEEDED" && (
                      <span className="text-[10px] bg-apple-green/10 text-apple-green px-1.5 py-0.5 rounded-full font-medium">
                        ✓ 已就绪
                      </span>
                    )}
                    {node.status === "STALE" && (
                      <span className="text-[10px] bg-apple-amber/10 text-apple-amber px-1.5 py-0.5 rounded-full font-medium">
                        ↻ 待重算
                      </span>
                    )}
                    {node.status === "PENDING" && (
                      <span className="text-[10px] text-ink-subtle">○ 未就绪</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-ink-muted">
                    <span>Gate 停下确认</span>
                    <input
                      type="checkbox"
                      checked={node.gate}
                      readOnly
                      className="accent-apple-blue w-3 h-3"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 bg-surface rounded-lg border border-border-subtle shadow-soft text-xs text-ink-muted">
          <div className="flex items-center gap-1.5 text-apple-blue font-medium mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>字段级 SHA256 守护</span>
          </div>
          <p className="text-[11px] text-ink-subtle leading-relaxed">
            修改口播台词仅重跑配音与合成，已生成的配图与BGM 100% 缓存复用。
          </p>
        </div>
      </div>

      {/* 2. Middle Shot Matrix Center Canvas */}
      <div className="flex-1 p-6 overflow-y-auto min-w-0">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div>
              <h2 className="text-base font-semibold text-ink">当前阶段：③ 分镜脚本拆解 (N03_SCRIPT)</h2>
              <p className="text-xs text-ink-muted">共 {shots.length} 个镜头 · 点击锁头图标锁定满意镜头不被修改</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviewPlan}
                className="px-3 py-1.5 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-soft flex items-center gap-1.5 transition-all"
              >
                <Layers className="w-3.5 h-3.5 text-apple-blue" />
                <span>预览增量 Plan</span>
              </button>
            </div>
          </div>

          {/* Shot Cards Matrix */}
          <div className="space-y-3">
            {shots.map((shot, idx) => (
              <div
                key={shot.shot_id}
                className={`p-4 rounded-apple border transition-all ${
                  shot.is_locked
                    ? "bg-surface border-apple-blue/50 shadow-soft"
                    : "bg-surface border-border-subtle hover:border-ink-muted/30 shadow-card"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-ink text-surface flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-ink">{shot.headline}</span>
                    <span className="text-[11px] text-ink-subtle flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {shot.est_duration}s
                    </span>
                  </div>

                  <button
                    onClick={() => toggleShotLock(shot.shot_id)}
                    className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all ${
                      shot.is_locked
                        ? "bg-apple-blue text-surface shadow-soft"
                        : "bg-surface-muted text-ink-muted hover:text-ink border border-border-subtle"
                    }`}
                  >
                    {shot.is_locked ? (
                      <>
                        <Lock className="w-3 h-3" />
                        <span>已锁定 (保护)</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3 h-3" />
                        <span>未锁定</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Narration */}
                <div className="text-xs text-ink bg-canvas p-2.5 rounded-md border border-border-subtle mb-2.5 leading-relaxed font-sans">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase mr-2 block mb-0.5">
                    🎙️ 配音台词 (Narration)
                  </span>
                  {shot.narration}
                </div>

                {/* Visual Prompt */}
                <div className="text-[11px] text-ink-muted bg-surface-muted/60 p-2.5 rounded-md border border-border-subtle flex items-start gap-2">
                  <span className="font-semibold text-ink text-[10px] shrink-0">🖼️ 画面描述:</span>
                  <span className="truncate">{shot.visual_prompt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Right Incremental Feedback & Actions Panel (320px) */}
      <div className="w-80 border-l border-border-subtle bg-surface p-4 shrink-0 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="text-xs font-semibold text-ink border-b border-border-subtle pb-2">
            基于当前版本增量反馈 (REFINE)
          </div>

          <div>
            <label className="text-[11px] font-medium text-ink-muted block mb-1.5">
              修改指令 (仅对未锁定镜头生效)
            </label>
            <textarea
              rows={4}
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
              placeholder="例如：第2镜语气太严肃，改成提问式口播；缩短到20字以内..."
              className="w-full text-xs p-2.5 rounded-md border border-border-subtle focus:border-apple-blue focus:outline-none bg-canvas text-ink resize-none leading-relaxed"
            />
          </div>

          <div className="p-3 bg-surface-muted rounded-md text-[11px] text-ink-muted space-y-1.5">
            <div className="flex justify-between">
              <span>已锁定镜头:</span>
              <span className="font-semibold text-apple-blue">
                {shots.filter((s) => s.is_locked).length} / {shots.length} 镜
              </span>
            </div>
            <div className="flex justify-between">
              <span>预计重算成本:</span>
              <span className="font-semibold text-ink">
                {shots.some((s) => !s.is_locked) ? "极低 (增量Diff)" : "0 消耗"}
              </span>
            </div>
          </div>

          {/* Dry-run plan alert */}
          {planPreview && (
            <div className="p-3 bg-apple-green/5 border border-apple-green/20 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-apple-green">
                <FileCheck className="w-4 h-4" />
                <span>增量执行计划 (Dry-Run Plan)</span>
              </div>
              <p className="text-[11px] text-ink-muted">
                将复用 <strong>{planPreview.estimated_reuse_count}</strong> 个节点产物，仅重算{" "}
                <strong>{planPreview.estimated_build_count}</strong> 个变更项。
              </p>
              <div className="space-y-1 max-h-36 overflow-y-auto text-[10px]">
                {planPreview.actions.map((act, idx) => (
                  <div key={idx} className="flex justify-between py-0.5 border-b border-border-subtle/50">
                    <span className="text-ink font-medium">{act.node_key}</span>
                    <span className={act.action === "REUSE" ? "text-apple-green font-semibold" : "text-apple-amber font-semibold"}>
                      {act.action === "REUSE" ? "✓ 复用" : "↻ 重算"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-4 border-t border-border-subtle">
          <button
            onClick={handleRefineSubmit}
            disabled={isProcessing || !refineInstruction.trim()}
            className="w-full py-2.5 px-4 bg-ink hover:bg-ink/90 disabled:opacity-50 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4 text-apple-blue" />
            <span>{isProcessing ? "增量计算中..." : "提交反馈并增量重算"}</span>
          </button>

          <button className="w-full py-2 px-4 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-card flex items-center justify-center gap-1.5 transition-all">
            <CheckCircle2 className="w-3.5 h-3.5 text-apple-green" />
            <span>确认通过此节点 (APPROVE)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
