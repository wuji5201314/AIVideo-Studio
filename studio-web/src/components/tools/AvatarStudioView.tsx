import React, { useEffect, useState } from "react";
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
  Activity,
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
  kind: "video" | "portrait";
  mediaUrl: string;
}

interface BatchTaskItem {
  id: string;
  title: string;
  script: string;
  avatarId: string;
  voiceName: string;
  subtitleStyle: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  videoPath?: string;
  durationSec?: number;
  engineNote?: string;
}

const AVATAR_MODELS: AvatarModel[] = [
  {
    id: "avatar_1",
    name: "活力小琳",
    tag: "好物带货 · 亲和热情",
    voice: "zh-HK-HiuMaanNeural",
    kind: "portrait",
    mediaUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "avatar_2",
    name: "极客阿辰",
    tag: "数码科技 · 沉稳口播",
    voice: "zh-CN-YunxiNeural",
    kind: "portrait",
    mediaUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "avatar_3",
    name: "知性苏老师",
    tag: "知识科普 · 深度干货",
    voice: "zh-CN-XiaoxiaoNeural",
    kind: "portrait",
    mediaUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "avatar_4",
    name: "商务顾总",
    tag: "商业财经 · 权威职场",
    voice: "zh-CN-YunjianNeural",
    kind: "portrait",
    mediaUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
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

  // Engine Status State
  const [heygemStatus, setHeygemStatus] = useState<{
    available: boolean;
    mode: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    api.getHeyGemStatus().then(setHeygemStatus).catch(() => null);
  }, []);

  // --- Mode 1: Batch Digital Human State ---
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("avatar_1");
  const [aspectRatio, setAspectRatio] = useState<string>("9:16");
  const [subtitleStyle, setSubtitleStyle] = useState<string>("douyin_yellow");
  const [customMediaUrl] = useState<string>("");
  const [newScript, setNewScript] = useState<string>("");
  const [fissionTopic, setFissionTopic] = useState<string>("");
  const [batchQueue, setBatchQueue] = useState<BatchTaskItem[]>([
    {
      id: "task_1",
      title: "口播任务 #1 · 痛点切入",
      script: "新手接触跨境电商最容易踩的3个大坑：盲目跟风、忽视底层逻辑、缺少复盘迭代，快来看看你中招没。",
      avatarId: "avatar_1",
      voiceName: "zh-HK-HiuMaanNeural",
      subtitleStyle: "douyin_yellow",
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

  // --- Handlers: Batch Queue ---
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
        subtitleStyle,
        status: "PENDING",
      },
    ]);
    setNewScript("");
  };

  const handleAiFissionBatch = () => {
    const topic = fissionTopic.trim() || "AI短视频自动化与数字人口播";
    const angles = [
      {
        tag: "痛点反转切角",
        text: `为什么你用了那么多工具做「${topic}」还是没流量？因为你缺的不是软件，而是一套工业级批量工作台。`,
      },
      {
        tag: "干货实操切角",
        text: `今天30秒教你搞定「${topic}」：第一步明确受众痛点，第二步AI智能裂变分镜，效率直接提升10倍！`,
      },
      {
        tag: "避坑指南切角",
        text: `新手做「${topic}」最容易踩的3个大坑：盲目跟风、忽视底层逻辑、缺少复盘迭代，快来看看你中招没。`,
      },
    ];
    const items: BatchTaskItem[] = angles.map((ang, i) => {
      const av = AVATAR_MODELS[i % AVATAR_MODELS.length];
      return {
        id: `task_${Date.now()}_${i}`,
        title: `裂变 #${i + 1} · ${ang.tag}`,
        script: ang.text,
        avatarId: av.id,
        voiceName: av.voice,
        subtitleStyle,
        status: "PENDING",
      };
    });
    setBatchQueue(items);
    setNotice(`已围绕「${topic}」智能裂变 3 条不同切角与主播的批量口播任务！`);
  };

  const runSingleBatchItem = async (task: BatchTaskItem) => {
    setBatchQueue((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "RUNNING" } : t)));
    const av = getAvatar(task.avatarId);
    const mediaSource = customMediaUrl.trim() || av.mediaUrl;
    try {
      const res = await api.executeOperator<{
        video_path: string;
        duration_sec: number;
        engine_note?: string;
      }>("op_digital_human", {
        text: task.script,
        voice_name: task.voiceName,
        face_image_path: mediaSource,
        source_kind: av.kind,
        avatar_name: av.name,
        avatar_tag: av.tag,
        sub_mode: "fast",
        aspect_ratio: aspectRatio,
        subtitle_style: task.subtitleStyle,
      });
      if (res?.video_path) {
        setBatchQueue((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: "DONE",
                  videoPath: res.video_path,
                  durationSec: res.duration_sec,
                  engineNote: res.engine_note,
                }
              : t
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
    setNotice("批量口播合成任务全部执行完成！");
  };

  // --- Handlers: Remake Wizard ---
  const handleExtractBenchmark = () => {
    if (!benchmarkUrl.trim()) {
      setBenchmarkUrl("https://v.douyin.com/example-anchor-video/");
    }
    setOriginalText(
      "做自媒体千万不要用肉身去拼更新频率！聪明人都在用 AI 数字人批量起号：先对标拆解爆款文案，再用自动化流水线一键生成 10 条矩阵视频，这才是普通人翻盘的最高杠杆！"
    );
    setRewrittenText(
      "想在短视频平台拿到结果，千万别靠死磕时长！真正的高手早就建立起标准化矩阵生产线：先结构化提炼高赞文案，再通过 AI 工作台快速复制出多条精美口播，直接把制作周期压缩到零成本！"
    );
    setRemakeStep(2);
  };

  const handleSynthesizeRemake = async () => {
    setIsRemaking(true);
    const av = getAvatar(selectedAvatarId);
    try {
      const res = await api.executeOperator<{ video_path: string; duration_sec: number }>(
        "op_digital_human",
        {
          text: rewrittenText.trim() || originalText.trim(),
          voice_name: av.voice,
          face_image_path: av.mediaUrl,
          avatar_name: av.name,
          avatar_tag: av.tag,
          sub_mode: "remake",
          aspect_ratio: aspectRatio,
          subtitle_style: subtitleStyle,
        }
      );
      if (res?.video_path) {
        setRemakeVideoPath(res.video_path);
        setRemakeStep(4);
      }
    } catch (e) {
      alert("复刻合成失败: " + String(e));
    } finally {
      setIsRemaking(false);
    }
  };

  // --- Handlers: LipSync ---
  const handleRunLipsync = async () => {
    if (!lipsyncText.trim()) return;
    setIsLipsyncing(true);
    const av = getAvatar(selectedAvatarId);
    try {
      const res = await api.executeOperator<{ video_path: string; duration_sec: number }>(
        "op_digital_human",
        {
          text: lipsyncText.trim(),
          voice_name: lipsyncVoice,
          face_image_path: av.mediaUrl,
          avatar_name: av.name,
          avatar_tag: av.tag,
          sub_mode: "lipsync",
          aspect_ratio: "9:16",
          subtitle_style: subtitleStyle,
        }
      );
      if (res?.video_path) {
        setLipsyncVideoPath(res.video_path);
      }
    } catch (e) {
      alert("对口型合成失败: " + String(e));
    } finally {
      setIsLipsyncing(false);
    }
  };

  const handleSaveToAsset = async (videoPath: string, title: string) => {
    try {
      await api.saveAsset({
        file_path: videoPath,
        kind: "video",
        title: `数字人口播成片 · ${title}`,
        meta: { operator: "op_digital_human" },
      });
      alert("成功存入素材库与 CAS 内容寻址存储！");
    } catch (e) {
      alert("存入失败: " + String(e));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Sub-tool Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-ink">数字人口播工作台</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue font-medium">
              JY_IPAgent 口播架构优化版
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            对齐专业短视频工作流：支持电影级呼吸推焦、抖音高燃金黄节奏字幕、顶部主播徽章及 HeyGem 对口型联动
          </p>
        </div>

        {/* HeyGem / Local Engine Status Pill */}
        <div className="flex items-center gap-2 p-2 px-3 rounded-lg bg-surface border border-border-subtle shadow-xs">
          <Activity
            className={`w-3.5 h-3.5 ${
              heygemStatus?.available ? "text-apple-green animate-pulse" : "text-apple-blue"
            }`}
          />
          <div className="text-xs font-medium text-ink">
            {heygemStatus?.available
              ? "HeyGem 口型服务在线 (端口 8383)"
              : "内置电影级动态运镜 + 抖音网感字幕"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-subtle pb-3">
        {[
          { id: "avatar_fast", label: "批量数字人口播", desc: "矩阵文案/多主播批量直出" },
          { id: "avatar_remake", label: "对标视频4步复刻", desc: "抽帧解析 · AI洗稿 · 换人成片" },
          { id: "avatar_lipsync", label: "音画双轨对口型", desc: "本地音频/文字驱动高精度口型" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-left ${
              activeTab === tab.id
                ? "bg-ink text-surface shadow-soft"
                : "bg-surface text-ink-muted hover:text-ink hover:bg-surface-muted border border-border-subtle"
            }`}
          >
            <div className="font-semibold">{tab.label}</div>
            <div className="text-[10px] opacity-80">{tab.desc}</div>
          </button>
        ))}
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
              <div className="text-xs font-semibold text-ink flex items-center justify-between">
                <span>1. 选择出镜主播底模</span>
                <span className="text-[10px] text-apple-blue">支持肖像呼吸运镜与视频底板</span>
              </div>
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
                    <img
                      src={av.mediaUrl}
                      alt={av.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-ink truncate">{av.name}</div>
                      <div className="text-[10px] text-ink-muted truncate">{av.tag}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subtitle Style & Aspect Ratio */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle">
                <div>
                  <label className="text-[11px] text-ink-muted block mb-1">网感字幕样式</label>
                  <select
                    value={subtitleStyle}
                    onChange={(e) => setSubtitleStyle(e.target.value)}
                    className="w-full text-xs p-1.5 rounded border border-border-subtle bg-canvas text-ink"
                  >
                    <option value="douyin_yellow">抖音爆款金黄 (粗体黑边)</option>
                    <option value="clean_white">纯白高光加深描边</option>
                    <option value="none">无字幕 (纯净画面)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-ink-muted block mb-1">画幅比例</label>
                  <div className="flex gap-1">
                    {["9:16", "16:9"].map((r) => (
                      <button
                        key={r}
                        onClick={() => setAspectRatio(r)}
                        className={`flex-1 py-1.5 text-[11px] rounded border cursor-pointer ${
                          aspectRatio === r
                            ? "border-apple-blue text-apple-blue font-semibold bg-apple-blue/5"
                            : "border-border-subtle text-ink-muted bg-canvas"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
              <div className="text-xs font-semibold text-ink flex items-center justify-between">
                <span>2. 批量任务录入 / AI 多切角裂变</span>
                <span className="text-[10px] text-apple-blue">支持多主播矩阵排期</span>
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
                    placeholder="输入行业主题，如：跨境电商、AI自媒体、健康养生..."
                    className="flex-1 text-xs p-2 rounded border border-border-subtle bg-surface text-ink"
                  />
                  <button
                    onClick={handleAiFissionBatch}
                    className="px-3 py-1.5 bg-apple-blue text-surface text-xs font-semibold rounded cursor-pointer shrink-0"
                  >
                    一键裂变
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
                <div className="flex items-center justify-end">
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

          {/* Right: Batch Execution Queue & Player (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-ink">3. 批量口播排期队列</h3>
                  <p className="text-[10px] text-ink-muted">
                    当前队列共有 {batchQueue.length} 个任务，可逐条微调或一键批处理
                  </p>
                </div>
                <button
                  onClick={handleRunAllBatch}
                  disabled={isRunningBatch || batchQueue.length === 0}
                  className="px-4 py-2 bg-ink text-surface text-xs font-semibold rounded-md shadow-soft flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-apple-blue" />
                  <span>{isRunningBatch ? "正在批量处理中..." : "一键批量极速合成"}</span>
                </button>
              </div>

              {/* Task Cards */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {batchQueue.map((item) => {
                  const av = getAvatar(item.avatarId);
                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-canvas rounded-lg border border-border-subtle flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <img
                          src={av.mediaUrl}
                          alt={av.name}
                          className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ink truncate">{item.title}</span>
                            <span className="text-[10px] text-ink-muted">({av.name})</span>
                            {item.status === "DONE" && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-apple-green/10 text-apple-green font-medium rounded">
                                已完成 ({item.durationSec}s)
                              </span>
                            )}
                            {item.status === "RUNNING" && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-apple-blue/10 text-apple-blue font-medium rounded animate-pulse">
                                合成中...
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                            {item.script}
                          </p>
                          {item.engineNote && (
                            <div className="text-[10px] text-apple-blue">
                              引擎：{item.engineNote}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.status === "DONE" && item.videoPath ? (
                          <>
                            <button
                              onClick={() => setActivePreviewVideo(item.videoPath || null)}
                              className="px-2.5 py-1 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded border border-border-subtle cursor-pointer"
                            >
                              播放
                            </button>
                            <a
                              href={getStreamUrl(item.videoPath, true)}
                              download={`${item.title}.mp4`}
                              className="px-2.5 py-1 bg-apple-green text-surface text-xs font-medium rounded flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              <span>下载</span>
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
                      <CheckCircle2 className="w-3.5 h-3.5" /> 数字人口播成片实时预览 (电影级呼吸运镜 + 抖音网感字幕)
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
                        <Download className="w-3.5 h-3.5" /> 直接下载 MP4
                      </a>
                    </div>
                  </div>
                  <video
                    key={activePreviewVideo}
                    src={getStreamUrl(activePreviewVideo)}
                    controls
                    autoPlay
                    className="w-full max-h-[360px] rounded bg-black object-contain shadow-soft"
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
              <h3 className="text-sm font-bold text-ink">第 1 步：输入对标爆款视频链接或脚本</h3>
              <input
                type="text"
                value={benchmarkUrl}
                onChange={(e) => setBenchmarkUrl(e.target.value)}
                placeholder="粘贴抖音/小红书爆款视频分享链接，例如 https://v.douyin.com/..."
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
                          `想在短视频平台拿到结果，千万别靠死磕时长！真正的高手早就建立起标准化矩阵生产线：先结构化提炼高赞文案，再通过 AI 工作台快速复制出多条精美口播，直接把制作周期压缩到零成本！`
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
                      selectedAvatarId === av.id
                        ? "border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue"
                        : "border-border-subtle bg-canvas"
                    }`}
                  >
                    <img
                      src={av.mediaUrl}
                      alt={av.name}
                      className="w-16 h-16 rounded-full mx-auto object-cover"
                    />
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
                  <span>爆款复刻合成成功！已应用电影级动态运镜与高燃字幕</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveToAsset(remakeVideoPath, "爆款复刻")}
                    className="px-3 py-1.5 bg-surface text-xs font-medium rounded border border-border-subtle flex items-center gap-1 cursor-pointer"
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
              <video
                src={getStreamUrl(remakeVideoPath)}
                controls
                autoPlay
                className="w-full max-h-[380px] rounded-lg bg-black object-contain shadow-soft"
              />
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
              <span>音画双轨对口型工坊 (Lip-Sync Engine)</span>
            </h3>

            <div>
              <label className="text-xs font-semibold text-ink block mb-2">
                轨道 A：选择人物底模视频 / 形象图
              </label>
              <div className="grid grid-cols-2 gap-2">
                {AVATAR_MODELS.map((av) => (
                  <div
                    key={av.id}
                    onClick={() => setSelectedAvatarId(av.id)}
                    className={`p-2 rounded border flex items-center gap-2 cursor-pointer ${
                      selectedAvatarId === av.id ? "border-apple-blue bg-apple-blue/5" : "border-border-subtle bg-canvas"
                    }`}
                  >
                    <img src={av.mediaUrl} alt={av.name} className="w-8 h-8 rounded-full object-cover" />
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
                <option value="zh-CN-YunxiNeural">云希 (沉稳男声驱动)</option>
                <option value="zh-CN-XiaoxiaoNeural">晓晓 (亲和女声驱动)</option>
                <option value="zh-HK-HiuMaanNeural">粤语晓曼 (港风口播驱动)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-ink mb-1">
                <span className="flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-apple-blue" /> 唇形张合灵敏度与面部超分辨率
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
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink">口型合成实时预览与工程质检</h3>
              {lipsyncVideoPath ? (
                <div className="space-y-3">
                  <video
                    src={getStreamUrl(lipsyncVideoPath)}
                    controls
                    autoPlay
                    className="w-full max-h-[300px] rounded bg-black object-contain shadow-soft"
                  />
                  <div className="p-3 bg-canvas rounded border border-border-subtle space-y-1 text-xs">
                    <div className="text-apple-green font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 音画口型对齐质检合格
                    </div>
                    <div className="text-ink-muted">
                      编码：H.264 / AAC · 音画采样率已标准化为 44.1kHz · 包含呼吸推焦动态
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[280px] border-2 border-dashed border-border-subtle rounded-lg flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <UserCheck className="w-10 h-10 text-ink-subtle" />
                  <div className="text-xs font-medium text-ink">等待合成启动</div>
                  <div className="text-[11px] text-ink-muted max-w-[240px]">
                    在左侧配置底模人物与驱动台词后，点击「立即执行」即可生成高精度口播成片
                  </div>
                </div>
              )}
            </div>

            {lipsyncVideoPath && (
              <div className="flex gap-2 pt-3">
                <button
                  onClick={() => handleSaveToAsset(lipsyncVideoPath, "对口型成片")}
                  className="flex-1 py-2 rounded bg-surface hover:bg-surface-muted text-ink border border-border-subtle text-xs font-medium cursor-pointer"
                >
                  存入素材库
                </button>
                <a
                  href={getStreamUrl(lipsyncVideoPath, true)}
                  download="lipsync-output.mp4"
                  className="flex-1 py-2 rounded bg-apple-blue text-surface text-xs font-semibold text-center flex items-center justify-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> 下载 MP4
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
