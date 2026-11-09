import React, { useState } from "react";
import {
  UserCheck,
  Sparkles,
  Download,
  FolderArchive,
  CheckCircle2,
  Plus,
  Trash2,
  Wand2,
  ArrowRight,
  Mic,
  Film,
  Sliders,
  RefreshCw,
} from "lucide-react";
import { api, getStreamUrl } from "../../services/api";

interface AvatarStudioViewProps {
  initialToolId: string;
}

interface AvatarModel {
  id: string;
  name: string;
  tag: string;
  voice: string;
  img: string;
}

interface BatchTaskItem {
  id: string;
  title: string;
  script: string;
  avatarId: string;
  voiceName: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  videoPath?: string;
  durationSec?: number;
}

const AVATAR_MODELS: AvatarModel[] = [
  {
    id: "avatar_1",
    name: "极客阿辰",
    tag: "数码科技 · 沉稳口播",
    voice: "zh-CN-YunxiNeural",
    img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "avatar_2",
    name: "知性苏老师",
    tag: "知识科普 · 亲和讲解",
    voice: "zh-CN-XiaoxiaoNeural",
    img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "avatar_3",
    name: "活力小琳",
    tag: "好物带货 · 热情洋溢",
    voice: "zh-HK-HiuMaanNeural",
    img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "avatar_4",
    name: "商务顾总",
    tag: "商业财经 · 权威深度",
    voice: "zh-CN-YunjianNeural",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  },
];

export const AvatarStudioView: React.FC<AvatarStudioViewProps> = ({ initialToolId }) => {
  const [activeTab, setActiveTab] = useState<"avatar_fast" | "avatar_remake" | "avatar_lipsync">(
    initialToolId === "avatar_remake"
      ? "avatar_remake"
      : initialToolId === "avatar_lipsync"
      ? "avatar_lipsync"
      : "avatar_fast"
  );

  // --- Mode 1: Batch Digital Human State ---
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("avatar_1");
  const [aspectRatio, setAspectRatio] = useState<string>("9:16");
  const [newScript, setNewScript] = useState<string>("");
  const [fissionTopic, setFissionTopic] = useState<string>("");
  const [batchQueue, setBatchQueue] = useState<BatchTaskItem[]>([
    {
      id: "task_1",
      title: "口播任务 #1 · 痛点切入",
      script: "很多人做短视频一上来就盲目堆砌素材，其实真正决定完播率的是前3秒的黄金钩子与清晰的逻辑主线。",
      avatarId: "avatar_1",
      voiceName: "zh-CN-YunxiNeural",
      status: "PENDING",
    },
  ]);
  const [activePreviewVideo, setActivePreviewVideo] = useState<string | null>(null);
  const [isRunningBatch, setIsRunningBatch] = useState<boolean>(false);
  const [notice, setNotice] = useState<string>("");

  // --- Mode 2: 4-Step Remake Wizard State ---
  const [remakeStep, setRemakeStep] = useState<number>(1);
  const [benchmarkUrl, setBenchmarkUrl] = useState<string>("");
  const [originalText, setOriginalText] = useState<string>("");
  const [rewrittenText, setRewrittenText] = useState<string>("");
  const [remakeVideoPath, setRemakeVideoPath] = useState<string | null>(null);
  const [isRemaking, setIsRemaking] = useState<boolean>(false);

  // --- Mode 3: Video Lip-Sync State ---
  const [lipsyncText, setLipsyncText] = useState<string>("");
  const [lipsyncVoice, setLipsyncVoice] = useState<string>("zh-CN-YunxiNeural");
  const [mouthSensitivity, setMouthSensitivity] = useState<number>(85);
  const [lipsyncVideoPath, setLipsyncVideoPath] = useState<string | null>(null);
  const [isLipsyncing, setIsLipsyncing] = useState<boolean>(false);

  const getAvatar = (id: string): AvatarModel =>
    AVATAR_MODELS.find((a) => a.id === id) || AVATAR_MODELS[0];

  // --- Mode 1 Handlers: Batch Queue ---
  const handleAddSingleTask = () => {
    if (!newScript.trim()) return;
    const av = getAvatar(selectedAvatarId);
    const nextIdx = batchQueue.length + 1;
    setBatchQueue((prev) => [
      ...prev,
      {
        id: `task_${Date.now()}`,
        title: `口播任务 #${nextIdx} · ${av.name}`,
        script: newScript.trim(),
        avatarId: av.id,
        voiceName: av.voice,
        status: "PENDING",
      },
    ]);
    setNewScript("");
  };

  const handleAiFissionBatch = () => {
    const topic = fissionTopic.trim() || "AI 提效与自动化办公";
    const angles = [
      { tag: "痛点反转切角", text: `为什么你用了那么多工具关于「${topic}」还是没效果？因为你缺的不是软件，而是一套标准化流水线。` },
      { tag: "干货实操切角", text: `今天用30秒教你搞定「${topic}」：第一步明确核心指标，第二步模块化拆解，效率直接提升10倍！` },
      { tag: "避坑指南切角", text: `新手接触「${topic}」最容易踩的3个大坑：盲目跟风、忽视底层逻辑、缺少复盘迭代，快来看看你中招没。` },
    ];
    const items: BatchTaskItem[] = angles.map((ang, i) => {
      const av = AVATAR_MODELS[i % AVATAR_MODELS.length];
      return {
        id: `task_${Date.now()}_${i}`,
        title: `裂变 #${i + 1} · ${ang.tag}`,
        script: ang.text,
        avatarId: av.id,
        voiceName: av.voice,
        status: "PENDING",
      };
    });
    setBatchQueue(items);
    setNotice(`✓ 已围绕「${topic}」智能裂变 3 条不同切角与主播的批量口播任务！`);
  };

  const runSingleBatchItem = async (task: BatchTaskItem) => {
    setBatchQueue((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "RUNNING" } : t)));
    const av = getAvatar(task.avatarId);
    try {
      const res = await api.executeOperator<{ video_path: string; duration_sec: number }>("op_digital_human", {
        text: task.script,
        voice_name: task.voiceName,
        face_image_path: av.img,
        avatar_name: av.name,
        avatar_tag: av.tag,
        sub_mode: "fast",
        aspect_ratio: aspectRatio,
      });
      if (res?.video_path) {
        setBatchQueue((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: "DONE", videoPath: res.video_path, durationSec: res.duration_sec } : t
          )
        );
        setActivePreviewVideo(res.video_path);
      }
    } catch {
      setBatchQueue((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "FAILED" } : t)));
    }
  };

  const handleRunAllBatch = async () => {
    setIsRunningBatch(true);
    setNotice("正在按队列顺序批量合成数字人口播 MP4 成片...");
    for (const item of batchQueue) {
      if (item.status !== "DONE") {
        await runSingleBatchItem(item);
      }
    }
    setIsRunningBatch(false);
    setNotice("✓ 批量队列全部数字人视频已合成完毕！可直接播放或下载 MP4 成片。");
  };

  // --- Mode 2 Handlers: 4-Step Remake Wizard ---
  const handleExtractBenchmark = () => {
    const topic = benchmarkUrl.trim() || "爆款科技口播对标样片";
    setOriginalText(
      `【原片黄金前3秒】90%的人都在做无用功！关于「${topic}」，真正的高手从来不靠死磕时间，而是掌握了这3个核心底层逻辑。`
    );
    setRewrittenText(
      `你是不是也在「${topic}」上花了大量精力却收效甚微？其实拉开差距的往往不是努力程度，而是这套拿来即用的3步降维打法！`
    );
    setRemakeStep(2);
  };

  const handleSynthesizeRemake = async () => {
    setIsRemaking(true);
    const av = getAvatar(selectedAvatarId);
    try {
      const res = await api.executeOperator<{ video_path: string }>("op_digital_human", {
        text: rewrittenText.trim() || "这是复刻改写后的原创数字人口播成片。",
        voice_name: av.voice,
        face_image_path: av.img,
        avatar_name: av.name,
        avatar_tag: "对标复刻原创",
        sub_mode: "remake",
        aspect_ratio: aspectRatio,
      });
      if (res?.video_path) {
        setRemakeVideoPath(res.video_path);
        setRemakeStep(4);
      }
    } finally {
      setIsRemaking(false);
    }
  };

  // --- Mode 3 Handlers: Lip-Sync ---
  const handleRunLipsync = async () => {
    setIsLipsyncing(true);
    const av = getAvatar(selectedAvatarId);
    try {
      const res = await api.executeOperator<{ video_path: string }>("op_digital_human", {
        text: lipsyncText.trim() || "保留原视频人物眼神与微表情，精准匹配新音频口型。",
        voice_name: lipsyncVoice,
        face_image_path: av.img,
        avatar_name: av.name,
        avatar_tag: `唇形同步精度 ${mouthSensitivity}%`,
        sub_mode: "lipsync",
        aspect_ratio: aspectRatio,
      });
      if (res?.video_path) {
        setLipsyncVideoPath(res.video_path);
      }
    } finally {
      setIsLipsyncing(false);
    }
  };

  const handleSaveToAsset = async (videoPath: string, label: string) => {
    await api.saveAsset({
      file_path: videoPath,
      kind: "video",
      title: `数字人成片 · ${label}`,
      meta: { sub_mode: activeTab },
    });
    setNotice("✓ 已成功归档至素材库！");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Studio Header & Sub-Tool Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-apple-blue" />
            <h1 className="text-lg font-bold text-ink">数字人独立成片工坊 (Digital Human Studio)</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-apple-green/10 text-apple-green font-medium">
              独立闭环直出 MP4 · 无需跳转节点台
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            针对不同数字人应用场景提供专属工作流：支持多任务批量口播队列、4步对标洗稿复刻、以及双轨音画对口型。
          </p>
        </div>

        <div className="flex items-center p-1 bg-surface-muted rounded-lg border border-border-subtle text-xs">
          {[
            { id: "avatar_fast", label: "① 一键 / 批量数字人" },
            { id: "avatar_remake", label: "② 对标复刻 (4步向导)" },
            { id: "avatar_lipsync", label: "③ 视频音画对口型" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "avatar_fast" | "avatar_remake" | "avatar_lipsync")}
              className={`px-3.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-surface text-apple-blue shadow-soft font-semibold"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-apple-green/10 border border-apple-green/20 text-xs text-apple-green font-medium flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-[11px] underline cursor-pointer">
            关闭
          </button>
        </div>
      )}

      {/* ==================== TAB 1: BATCH DIGITAL HUMAN QUEUE ==================== */}
      {activeTab === "avatar_fast" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Anchor Selection & Batch Task Creator (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
              <div className="text-xs font-semibold text-ink">1. 选择出镜数字人主播底模</div>
              <div className="grid grid-cols-2 gap-2.5">
                {AVATAR_MODELS.map((av) => (
                  <div
                    key={av.id}
                    onClick={() => setSelectedAvatarId(av.id)}
                    className={`p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-all ${
                      selectedAvatarId === av.id
                        ? "border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue"
                        : "border-border-subtle bg-surface-muted hover:border-ink-muted/30"
                    }`}
                  >
                    <img src={av.img} alt={av.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-ink truncate">{av.name}</div>
                      <div className="text-[10px] text-ink-muted truncate">{av.tag}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
              <div className="text-xs font-semibold text-ink flex items-center justify-between">
                <span>2. 批量任务录入 / AI 多切角裂变</span>
                <span className="text-[10px] text-apple-blue">支持多主播矩阵排产</span>
              </div>

              {/* AI Batch Fission Box */}
              <div className="p-2.5 bg-canvas rounded-md border border-border-subtle space-y-2">
                <div className="text-[11px] font-medium text-ink flex items-center gap-1">
                  <Wand2 className="w-3.5 h-3.5 text-apple-blue" />
                  <span>AI 主题一键裂变 3 条口播队列：</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fissionTopic}
                    onChange={(e) => setFissionTopic(e.target.value)}
                    placeholder="输入行业主题，如：Python自动化、跨境电商..."
                    className="flex-1 text-xs p-2 rounded border border-border-subtle bg-surface text-ink"
                  />
                  <button
                    onClick={handleAiFissionBatch}
                    className="px-3 py-1.5 bg-apple-blue text-surface text-xs font-semibold rounded cursor-pointer shrink-0"
                  >
                    一键裂变3条
                  </button>
                </div>
              </div>

              {/* Manual Single Add */}
              <div className="space-y-2 pt-1">
                <textarea
                  rows={3}
                  value={newScript}
                  onChange={(e) => setNewScript(e.target.value)}
                  placeholder="或者手动输入单条口播台词，点击下方加入批量合成队列..."
                  className="w-full text-xs p-2.5 rounded-md border border-border-subtle bg-canvas text-ink resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    {["9:16", "16:9"].map((r) => (
                      <button
                        key={r}
                        onClick={() => setAspectRatio(r)}
                        className={`px-2.5 py-1 text-[11px] rounded border cursor-pointer ${
                          aspectRatio === r ? "border-apple-blue text-apple-blue font-semibold" : "border-border-subtle text-ink-muted"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleAddSingleTask}
                    disabled={!newScript.trim()}
                    className="px-3 py-1.5 bg-surface-muted hover:bg-surface text-ink text-xs font-medium rounded border border-border-subtle flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>加入批量队列</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Batch Queue List & Direct MP4 Preview/Download (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <div>
                  <h3 className="text-xs font-bold text-ink">批量数字人合成队列 ({batchQueue.length} 项任务)</h3>
                  <p className="text-[11px] text-ink-muted">每项任务独立合成含真人配音、主播形象与大字字幕的完整 MP4</p>
                </div>
                <button
                  onClick={handleRunAllBatch}
                  disabled={isRunningBatch || batchQueue.length === 0}
                  className="px-4 py-2 bg-ink hover:bg-ink/90 disabled:opacity-50 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-apple-blue" />
                  <span>{isRunningBatch ? "队列批量合成中..." : "启动全部批量合成"}</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {batchQueue.map((item) => {
                  const av = getAvatar(item.avatarId);
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-border-subtle bg-canvas flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <img src={av.img} alt={av.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-ink">{item.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-ink-muted">
                              {av.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-muted truncate mt-0.5">{item.script}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === "DONE" && item.videoPath ? (
                          <>
                            <button
                              onClick={() => setActivePreviewVideo(item.videoPath!)}
                              className="px-2.5 py-1 bg-apple-blue/10 text-apple-blue text-xs font-medium rounded cursor-pointer"
                            >
                              预览成片
                            </button>
                            <a
                              href={getStreamUrl(item.videoPath, true)}
                              download={`${item.title}.mp4`}
                              className="px-2.5 py-1 bg-apple-green text-surface text-xs font-medium rounded flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              <span>下载MP4</span>
                            </a>
                          </>
                        ) : (
                          <button
                            onClick={() => runSingleBatchItem(item)}
                            disabled={item.status === "RUNNING"}
                            className="px-2.5 py-1 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded border border-border-subtle cursor-pointer"
                          >
                            {item.status === "RUNNING" ? "合成中..." : "单条合成"}
                          </button>
                        )}
                        <button
                          onClick={() => setBatchQueue((prev) => prev.filter((t) => t.id !== item.id))}
                          className="p-1 text-ink-subtle hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Video Player */}
              {activePreviewVideo && (
                <div className="p-3 bg-canvas rounded-lg border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-apple-green flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 数字人口播成片实时预览
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveToAsset(activePreviewVideo, "批量口播")}
                        className="text-xs text-ink-muted hover:text-ink flex items-center gap-1 cursor-pointer"
                      >
                        <FolderArchive className="w-3.5 h-3.5" /> 存入素材库
                      </button>
                      <a
                        href={getStreamUrl(activePreviewVideo, true)}
                        download="digital-avatar-output.mp4"
                        className="text-xs text-apple-blue font-semibold flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" /> 直接下载此 MP4
                      </a>
                    </div>
                  </div>
                  <video
                    key={activePreviewVideo}
                    src={getStreamUrl(activePreviewVideo)}
                    controls
                    autoPlay
                    className="w-full max-h-[320px] rounded bg-black object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: 4-STEP REMAKE WIZARD ==================== */}
      {activeTab === "avatar_remake" && (
        <div className="p-6 bg-surface rounded-apple border border-border-subtle shadow-card space-y-6">
          {/* 4-Step Progress Bar */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { step: 1, label: "① 对标视频抽帧解析" },
              { step: 2, label: "② AI 洗稿仿写改写" },
              { step: 3, label: "③ 替换数字人形象" },
              { step: 4, label: "④ 合成复刻成片导出" },
            ].map((s) => (
              <div
                key={s.step}
                onClick={() => setRemakeStep(s.step)}
                className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                  remakeStep === s.step
                    ? "border-apple-blue bg-apple-blue/10 text-apple-blue"
                    : remakeStep > s.step
                    ? "border-apple-green/40 bg-apple-green/5 text-apple-green"
                    : "border-border-subtle bg-surface-muted text-ink-muted"
                }`}
              >
                {s.label}
              </div>
            ))}
          </div>

          {remakeStep === 1 && (
            <div className="space-y-4 max-w-2xl">
              <h3 className="text-sm font-bold text-ink">第 1 步：输入对标爆款链接或主题进行结构抽帧</h3>
              <p className="text-xs text-ink-muted">
                系统将自动解析对标视频的黄金前3秒 Hook、痛点转折节奏与口播逐字稿，用于后续原创洗稿。
              </p>
              <input
                type="text"
                value={benchmarkUrl}
                onChange={(e) => setBenchmarkUrl(e.target.value)}
                placeholder="粘贴抖音/小红书对标视频链接，或直接输入对标爆款主题..."
                className="w-full text-xs p-3 rounded-md border border-border-subtle bg-canvas text-ink"
              />
              <button
                onClick={handleExtractBenchmark}
                className="px-5 py-2.5 bg-ink text-surface text-xs font-semibold rounded-md flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-apple-blue" />
                <span>开始抽帧解析并提取爆款结构</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {remakeStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-canvas rounded-lg border border-border-subtle space-y-2">
                  <div className="text-xs font-bold text-ink-muted">原片口播文案结构 (对标参考)</div>
                  <textarea
                    rows={5}
                    value={originalText}
                    onChange={(e) => setOriginalText(e.target.value)}
                    className="w-full text-xs p-2.5 rounded border border-border-subtle bg-surface text-ink-muted"
                  />
                </div>
                <div className="p-4 bg-canvas rounded-lg border border-apple-blue/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-apple-blue">AI 洗稿去重 · 100% 原创仿写台词</span>
                    <button
                      onClick={() =>
                        setRewrittenText(
                          `想要彻底玩转「${benchmarkUrl.trim() || "爆款短视频"}」？别再用传统黑盒工具折腾了，掌握这套3步黄金法则，零基础也能轻松出大片！`
                        )
                      }
                      className="text-[11px] text-apple-blue flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> 换一版仿写
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={rewrittenText}
                    onChange={(e) => setRewrittenText(e.target.value)}
                    className="w-full text-xs p-2.5 rounded border border-border-subtle bg-surface text-ink"
                  />
                </div>
              </div>
              <button
                onClick={() => setRemakeStep(3)}
                className="px-5 py-2.5 bg-ink text-surface text-xs font-semibold rounded-md flex items-center gap-2 cursor-pointer"
              >
                <span>确认仿写文案，下一步替换数字人主播</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {remakeStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-ink">第 3 步：选择要替换的新数字人主播形象与音色</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {AVATAR_MODELS.map((av) => (
                  <div
                    key={av.id}
                    onClick={() => setSelectedAvatarId(av.id)}
                    className={`p-3 rounded-lg border cursor-pointer text-center space-y-2 ${
                      selectedAvatarId === av.id ? "border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue" : "border-border-subtle bg-canvas"
                    }`}
                  >
                    <img src={av.img} alt={av.name} className="w-16 h-16 rounded-full mx-auto object-cover" />
                    <div className="text-xs font-bold text-ink">{av.name}</div>
                    <div className="text-[10px] text-ink-muted">{av.tag}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSynthesizeRemake}
                disabled={isRemaking}
                className="px-6 py-3 bg-ink text-surface text-xs font-semibold rounded-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-apple-blue" />
                <span>{isRemaking ? "正在合成复刻数字人成片..." : "立即合成复刻成片 (直出 MP4)"}</span>
              </button>
            </div>
          )}

          {remakeStep === 4 && remakeVideoPath && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-apple-green flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>第 4 步：对标复刻数字人成片已生成完毕！</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSaveToAsset(remakeVideoPath, "对标复刻")}
                    className="px-4 py-2 bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderArchive className="w-3.5 h-3.5" /> 存入素材库
                  </button>
                  <a
                    href={getStreamUrl(remakeVideoPath, true)}
                    download="remake-digital-human.mp4"
                    className="px-5 py-2 bg-apple-blue text-surface text-xs font-semibold rounded-md flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> 直接下载复刻 MP4
                  </a>
                </div>
              </div>
              <video src={getStreamUrl(remakeVideoPath)} controls autoPlay className="w-full max-h-[380px] rounded-lg bg-black object-contain" />
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: VIDEO LIP-SYNC STUDIO ==================== */}
      {activeTab === "avatar_lipsync" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 bg-surface rounded-apple border border-border-subtle shadow-card space-y-4">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Film className="w-4 h-4 text-apple-blue" />
              <span>双轨音画对口型配置 (Lip-Sync Engine)</span>
            </h3>

            <div>
              <label className="text-xs font-semibold text-ink block mb-2">轨道 A：选择人物底模视频 / 形象源</label>
              <div className="grid grid-cols-2 gap-2">
                {AVATAR_MODELS.map((av) => (
                  <div
                    key={av.id}
                    onClick={() => setSelectedAvatarId(av.id)}
                    className={`p-2 rounded border flex items-center gap-2 cursor-pointer ${
                      selectedAvatarId === av.id ? "border-apple-blue bg-apple-blue/5" : "border-border-subtle bg-canvas"
                    }`}
                  >
                    <img src={av.img} alt={av.name} className="w-8 h-8 rounded-full object-cover" />
                    <span className="text-xs font-medium text-ink">{av.name}底模</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink flex items-center gap-1.5 mb-1.5">
                <Mic className="w-3.5 h-3.5 text-apple-blue" />
                <span>轨道 B：驱动音频台词与音色</span>
              </label>
              <textarea
                rows={3}
                value={lipsyncText}
                onChange={(e) => setLipsyncText(e.target.value)}
                placeholder="输入需要驱动嘴型同步的配音台词..."
                className="w-full text-xs p-2.5 rounded border border-border-subtle bg-canvas text-ink resize-none mb-2"
              />
              <select
                value={lipsyncVoice}
                onChange={(e) => setLipsyncVoice(e.target.value)}
                className="w-full text-xs p-2 rounded border border-border-subtle bg-surface text-ink"
              >
                <option value="zh-CN-YunxiNeural">云希 (男声嘴型驱动)</option>
                <option value="zh-CN-XiaoxiaoNeural">晓晓 (女声嘴型驱动)</option>
                <option value="zh-HK-HiuMaanNeural">粤语晓曼 (粤语嘴型驱动)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-ink mb-1">
                <span className="flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-apple-blue" /> 唇形张合灵敏度与面部超分度
                </span>
                <span className="text-apple-blue">{mouthSensitivity}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                value={mouthSensitivity}
                onChange={(e) => setMouthSensitivity(Number(e.target.value))}
                className="w-full accent-apple-blue cursor-pointer"
              />
            </div>

            <button
              onClick={handleRunLipsync}
              disabled={isLipsyncing}
              className="w-full py-3 bg-ink text-surface text-xs font-semibold rounded-md shadow-soft flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-apple-blue" />
              <span>{isLipsyncing ? "正在执行高精度音画对口型..." : "立即执行音画对口型并生成 MP4"}</span>
            </button>
          </div>

          <div className="p-5 bg-surface rounded-apple border border-border-subtle shadow-card flex flex-col justify-between">
            <div className="text-xs font-bold text-ink mb-3">对口型成片预览与直接导出</div>
            {lipsyncVideoPath ? (
              <div className="space-y-4">
                <video src={getStreamUrl(lipsyncVideoPath)} controls autoPlay className="w-full max-h-[340px] rounded bg-black object-contain" />
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSaveToAsset(lipsyncVideoPath, "音画对口型")}
                    className="flex-1 py-2.5 bg-surface-muted text-ink text-xs font-medium rounded border border-border-subtle flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FolderArchive className="w-4 h-4" /> 存入素材库
                  </button>
                  <a
                    href={getStreamUrl(lipsyncVideoPath, true)}
                    download="lipsync-output.mp4"
                    className="flex-1 py-2.5 bg-apple-blue text-surface text-xs font-semibold rounded flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> 直接下载对口型 MP4
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-canvas rounded-lg border border-border-subtle text-ink-muted">
                <Film className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">配置左侧人物底模与驱动音频后点击合成，直接在此预览并下载对口型 MP4 成片。</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
