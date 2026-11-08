import React, { useEffect, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Layers,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import { api, getStreamUrl } from "../../services/api";
import type { ExecutionPlan, PlanAction, ShotItem, WorkbenchSeed } from "../../services/api";
import { BriefStageView } from "./stages/BriefStageView";
import type { ProjectBriefConfig } from "./stages/BriefStageView";
import { TopicStageView } from "./stages/TopicStageView";
import type { TopicCandidate } from "./stages/TopicStageView";
import { ScriptStageView } from "./stages/ScriptStageView";
import { VoiceStageView } from "./stages/VoiceStageView";
import { MaterialStageView } from "./stages/MaterialStageView";
import { ShotRenderStageView } from "./stages/ShotRenderStageView";
import { ExportStageView } from "./stages/ExportStageView";

interface WorkflowStudioViewProps {
  initialSeed?: WorkbenchSeed | null;
}

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

const STAGES = [
  { id: "N01_BRIEF", label: "① 项目设定", status: "SUCCEEDED", gate: false },
  { id: "N02_TOPIC", label: "② 选题确认", status: "SUCCEEDED", gate: true },
  { id: "N03_SCRIPT", label: "③ 分镜脚本", status: "SUCCEEDED", gate: true },
  { id: "N05_VOICE", label: "④ 分镜配音", status: "SUCCEEDED", gate: true },
  { id: "N06_MATERIAL", label: "⑤ 分镜画面", status: "STALE", gate: true },
  { id: "N07_SHOT_RENDER", label: "⑥ 单镜合成", status: "STALE", gate: false },
  { id: "N11_EXPORT", label: "⑦ 混音成片", status: "PENDING", gate: true },
];

export const WorkflowStudioView: React.FC<WorkflowStudioViewProps> = ({ initialSeed }) => {
  const [activeStage, setActiveStage] = useState<string>("N01_BRIEF");
  const [shots, setShots] = useState<ShotItem[]>(INITIAL_SHOTS);
  const [stageStatuses, setStageStatuses] = useState<Record<string, "SUCCEEDED" | "STALE" | "PENDING">>({
    N01_BRIEF: "SUCCEEDED",
    N02_TOPIC: "SUCCEEDED",
    N03_SCRIPT: "SUCCEEDED",
    N05_VOICE: "SUCCEEDED",
    N06_MATERIAL: "STALE",
    N07_SHOT_RENDER: "PENDING",
    N11_EXPORT: "PENDING",
  });
  const [briefConfig, setBriefConfig] = useState<ProjectBriefConfig>({
    title: "新一代 AI 视频工作流全拆解",
    topicPrompt: initialSeed?.prompt || "欢迎体验新一代 AI 视频工作台，零成本极速出片。",
    stylePreset: "vlog",
    aspectRatio: initialSeed?.aspectRatio || "9:16",
    targetDurationSec: 30,
    voiceName: initialSeed?.voiceName || "zh-CN-YunxiNeural",
  });
  const [refineInstruction, setRefineInstruction] = useState<string>("");
  const [planPreview, setPlanPreview] = useState<ExecutionPlan | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [approveNotice, setApproveNotice] = useState<string>("");

  useEffect(() => {
    if (!initialSeed) return;
    if (initialSeed.shots && initialSeed.shots.length > 0) {
      setShots(initialSeed.shots);
      setActiveStage("N03_SCRIPT");
      return;
    }
    setShots((prev) => {
      const updated = [...prev];
      updated[0] = {
        ...updated[0],
        headline: `导入自：${initialSeed.sourceToolName || "快捷工具"}`,
        narration: initialSeed.prompt || updated[0].narration,
        audio_path: initialSeed.mediaType === "audio" ? initialSeed.mediaPath : updated[0].audio_path,
        visual_path:
          initialSeed.mediaType === "video" || initialSeed.mediaType === "image"
            ? initialSeed.mediaPath
            : updated[0].visual_path,
        is_locked: true,
      };
      return updated;
    });
    setBriefConfig((prev) => ({
      ...prev,
      topicPrompt: initialSeed.prompt || prev.topicPrompt,
      aspectRatio: initialSeed.aspectRatio || prev.aspectRatio,
      voiceName: initialSeed.voiceName || prev.voiceName,
    }));
  }, [initialSeed]);

  const toggleShotLock = (shotId: string) => {
    setShots((prev) =>
      prev.map((s) => (s.shot_id === shotId ? { ...s, is_locked: !s.is_locked } : s))
    );
  };

  const handleUpdateShotAudio = (shotId: string, audioPath: string, durationSec: number) => {
    setShots((prev) =>
      prev.map((s) =>
        s.shot_id === shotId ? { ...s, audio_path: audioPath, est_duration: durationSec } : s
      )
    );
  };

  const handleUpdateShotVisual = (shotId: string, visualPath: string) => {
    setShots((prev) => {
      const updated = prev.map((s) => (s.shot_id === shotId ? { ...s, visual_path: visualPath } : s));
      if (updated.every((s) => Boolean(s.visual_path))) {
        setStageStatuses((statuses) => ({ ...statuses, N06_MATERIAL: "SUCCEEDED" }));
      }
      return updated;
    });
  };

  const handleBatchUpdateVisuals = (updates: Record<string, string>) => {
    setShots((prev) =>
      prev.map((s) => (updates[s.shot_id] ? { ...s, visual_path: updates[s.shot_id] } : s))
    );
    setStageStatuses((prev) => ({
      ...prev,
      N06_MATERIAL: "SUCCEEDED",
      N07_SHOT_RENDER: "STALE",
    }));
    setApproveNotice("✓ 全部分镜画面采买生成就绪！节点 ⑤ 分镜画面 已标记为「已就绪」");
  };

  const handleConfirmMaterials = () => {
    setStageStatuses((prev) => ({
      ...prev,
      N06_MATERIAL: "SUCCEEDED",
      N07_SHOT_RENDER: prev.N07_SHOT_RENDER === "PENDING" ? "STALE" : prev.N07_SHOT_RENDER,
    }));
    setActiveStage("N07_SHOT_RENDER");
    setApproveNotice("✓ 节点 ⑤ 分镜画面 已确认就绪，已推进至 ⑥ 单镜独立合成！");
  };

  const handleNextStage = (nextStageId: string) => {
    setActiveStage(nextStageId);
    setApproveNotice(`✓ 已切换至节点 ${nextStageId}`);
  };

  const handleRefineSubmit = async () => {
    if (!refineInstruction.trim()) return;
    setIsProcessing(true);
    setApproveNotice("");
    try {
      const lockedKeys = shots.filter((s) => s.is_locked).map((s) => s.shot_id);
      const res = await api.executeOperator<{ shots: ShotItem[] }>(
        "op_script_storyboard",
        {
          prompt: briefConfig.topicPrompt,
          shot_count: shots.length,
          base_script: {
            title: briefConfig.title,
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
        setApproveNotice("✓ 已按反馈增量更新未锁定镜头，已锁定镜头 100% 保持原样！");
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

  const handleApproveCurrentStage = () => {
    setStageStatuses((prev) => ({
      ...prev,
      [activeStage]: "SUCCEEDED",
    }));
    const stageIds = STAGES.map((s) => s.id);
    const idx = stageIds.indexOf(activeStage);
    const nextId = idx >= 0 && idx < stageIds.length - 1 ? stageIds[idx + 1] : activeStage;
    setActiveStage(nextId);
    setApproveNotice(`✓ 节点 ${activeStage} 确认通过 (APPROVE)，已推进至 ${nextId}！`);
  };

  // Render the dedicated view for the current active node
  const renderStageCenter = () => {
    switch (activeStage) {
      case "N01_BRIEF":
        return (
          <BriefStageView
            config={briefConfig}
            onChange={(up) => setBriefConfig((prev) => ({ ...prev, ...up }))}
            onNextStage={() => {
              setStageStatuses((prev) => ({ ...prev, N01_BRIEF: "SUCCEEDED" }));
              handleNextStage("N02_TOPIC");
            }}
          />
        );
      case "N02_TOPIC":
        return (
          <TopicStageView
            onSelectTopic={(topic: TopicCandidate) =>
              setBriefConfig((prev) => ({ ...prev, title: topic.title }))
            }
            onNextStage={() => {
              setStageStatuses((prev) => ({ ...prev, N02_TOPIC: "SUCCEEDED" }));
              handleNextStage("N03_SCRIPT");
            }}
          />
        );
      case "N03_SCRIPT":
        return (
          <ScriptStageView
            shots={shots}
            onToggleLock={toggleShotLock}
            onNextStage={() => {
              setStageStatuses((prev) => ({ ...prev, N03_SCRIPT: "SUCCEEDED" }));
              handleNextStage("N05_VOICE");
            }}
          />
        );
      case "N05_VOICE":
        return (
          <VoiceStageView
            shots={shots}
            defaultVoice={briefConfig.voiceName}
            onUpdateShotAudio={handleUpdateShotAudio}
            onNextStage={() => {
              setStageStatuses((prev) => ({ ...prev, N05_VOICE: "SUCCEEDED" }));
              handleNextStage("N06_MATERIAL");
            }}
          />
        );
      case "N06_MATERIAL":
        return (
          <MaterialStageView
            shots={shots}
            onUpdateShotVisual={handleUpdateShotVisual}
            onBatchUpdateVisuals={handleBatchUpdateVisuals}
            onConfirmMaterials={handleConfirmMaterials}
          />
        );
      case "N07_SHOT_RENDER":
        return (
          <ShotRenderStageView
            shots={shots}
            defaultVoice={briefConfig.voiceName}
            onUpdateShot={(shotId, updates) => {
              setShots((prev) =>
                prev.map((s) => (s.shot_id === shotId ? { ...s, ...updates } : s))
              );
            }}
            onNextStage={() => {
              setStageStatuses((prev) => ({ ...prev, N07_SHOT_RENDER: "SUCCEEDED" }));
              handleNextStage("N11_EXPORT");
            }}
          />
        );
      case "N11_EXPORT":
        return <ExportStageView shots={shots} projectTitle={briefConfig.title} />;
      default:
        return null;
    }
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
            {STAGES.map((node) => {
              const isSelected = activeStage === node.id;
              const status = stageStatuses[node.id] || node.status;
              return (
                <div
                  key={node.id}
                  onClick={() => setActiveStage(node.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "border-apple-blue bg-surface shadow-soft ring-1 ring-apple-blue"
                      : "border-border-subtle bg-surface/40 hover:bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold ${isSelected ? "text-apple-blue" : "text-ink"}`}>
                      {node.label}
                    </span>
                    {status === "SUCCEEDED" && (
                      <span className="text-[10px] bg-apple-green/10 text-apple-green px-1.5 py-0.5 rounded-full font-medium">
                        ✓ 已就绪
                      </span>
                    )}
                    {status === "STALE" && (
                      <span className="text-[10px] bg-apple-amber/10 text-apple-amber px-1.5 py-0.5 rounded-full font-medium">
                        ↻ 待重算
                      </span>
                    )}
                    {status === "PENDING" && (
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

      {/* 2. Middle Stage Dynamic Canvas */}
      <div className="flex-1 p-6 overflow-y-auto min-w-0 bg-canvas">
        <div className="max-w-4xl mx-auto space-y-4">
          {initialSeed && activeStage === "N03_SCRIPT" && (
            <div className="p-3.5 bg-apple-blue/5 border border-apple-blue/30 rounded-apple flex items-center justify-between gap-4">
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-apple-blue flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    已从「{initialSeed.sourceToolName || "子工具"}」导入资产并注入第 1 镜（画幅{" "}
                    {initialSeed.aspectRatio || "9:16"}）
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted">
                  第 1 镜已自动加锁保护，您可以直接试听配音，或对其他镜头发起增量修改。
                </p>
              </div>
              {initialSeed.mediaPath && initialSeed.mediaType === "audio" && (
                <audio src={getStreamUrl(initialSeed.mediaPath)} controls className="h-8 w-56 shrink-0" />
              )}
            </div>
          )}

          {approveNotice && (
            <div className="p-2.5 bg-apple-green/10 border border-apple-green/30 rounded-md text-xs text-apple-green font-medium">
              {approveNotice}
            </div>
          )}

          {/* Dynamic Content by Stage */}
          {renderStageCenter()}
        </div>
      </div>

      {/* 3. Right Incremental Feedback & Stage Status (320px) */}
      <div className="w-80 border-l border-border-subtle bg-surface p-4 shrink-0 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="text-xs font-semibold text-ink border-b border-border-subtle pb-2 flex items-center justify-between">
            <span>当前节点操作看板</span>
            <span className="text-[10px] text-apple-blue font-mono">{activeStage}</span>
          </div>

          {activeStage === "N03_SCRIPT" ? (
            <>
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

              <button
                onClick={handlePreviewPlan}
                className="w-full py-2 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-soft flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-apple-blue" />
                <span>预览增量 Plan</span>
              </button>

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
                </div>
              )}
            </>
          ) : (
            <div className="p-3 bg-surface-muted rounded-lg text-xs text-ink-muted space-y-2 leading-relaxed">
              <div className="font-semibold text-ink">
                {activeStage === "N01_BRIEF" && "项目设定指引"}
                {activeStage === "N02_TOPIC" && "爆款选题策略"}
                {activeStage === "N05_VOICE" && "音轨精修指引"}
                {activeStage === "N06_MATERIAL" && "分镜运镜控制"}
                {activeStage === "N07_SHOT_RENDER" && "单镜渲染机制"}
                {activeStage === "N11_EXPORT" && "成片混音规格"}
              </div>
              <p className="text-[11px] text-ink-subtle">
                {activeStage === "N01_BRIEF" && "全局设定决定成片的整体基调与预估时长。点击下方确认即可生成匹配选题。"}
                {activeStage === "N02_TOPIC" && "挑选具有高完播率与强情绪钩子的选题，后续分镜将紧扣此选题展开。"}
                {activeStage === "N05_VOICE" && "单镜配音支持按句重录，修改单镜台词不会影响其他镜头的配音文件。"}
                {activeStage === "N06_MATERIAL" && "推拉摇移（Ken Burns）镜头完全在本地零成本生成，可自由替换单镜画面。"}
                {activeStage === "N07_SHOT_RENDER" && "每个镜头独立渲染音画合一片段，便于在全片导出前精确定位问题。"}
                {activeStage === "N11_EXPORT" && "全片已就绪，可一键完成多轨混音并导出高清 MP4，或归档入素材库。"}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-4 border-t border-border-subtle">
          {activeStage === "N03_SCRIPT" && (
            <button
              onClick={handleRefineSubmit}
              disabled={isProcessing || !refineInstruction.trim()}
              className="w-full py-2.5 px-4 bg-ink hover:bg-ink/90 disabled:opacity-50 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-apple-blue" />
              <span>{isProcessing ? "增量计算中..." : "提交反馈并增量重算"}</span>
            </button>
          )}

          <button
            onClick={handleApproveCurrentStage}
            className="w-full py-2 px-4 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-card flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-apple-green" />
            <span>确认通过此节点 (APPROVE)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
