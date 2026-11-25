import React, { useEffect, useRef, useState } from "react";
import {
  Upload,
  Link2,
  Sparkles,
  Download,
  FolderArchive,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Film,
  Volume2,
  Sliders,
  Loader2,
} from "lucide-react";
import {
  api,
  type AvatarEnginesResponse,
  type AvatarTaskStatus,
  type BenchmarkParseResult,
  getStreamUrl,
} from "../../../services/api";

interface PresetAvatar {
  id: string;
  name: string;
  tag: string;
  voice: string;
  imageUrl: string;
}

const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: "av_1",
    name: "活力小琳",
    tag: "实体探店 · 亲和热情",
    voice: "zh-CN-XiaoxiaoNeural",
    imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "av_2",
    name: "极客阿辰",
    tag: "数码科技 · 沉稳口播",
    voice: "zh-CN-YunxiNeural",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "av_3",
    name: "知性苏老师",
    tag: "知识科普 · 专业讲解",
    voice: "zh-HK-HiuMaanNeural",
    imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "av_4",
    name: "商务顾总",
    tag: "实体商业 · 权威深度",
    voice: "zh-CN-YunjianNeural",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
  },
];

const STAGES = [
  { key: "preprocess", label: "1. 解析与预处理" },
  { key: "wan_animate", label: "2. 人物替换推理" },
  { key: "postprocess", label: "3. 配音与字幕封装" },
  { key: "done", label: "4. 成片输出" },
];

interface CharacterReplaceStudioProps {
  enginesData: AvatarEnginesResponse | null;
  onOpenSettings: () => void;
}

export const CharacterReplaceStudio: React.FC<CharacterReplaceStudioProps> = ({
  enginesData,
  onOpenSettings,
}) => {
  // 1. Source driving video state
  const [shareUrl, setShareUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [parsed, setParsed] = useState<BenchmarkParseResult | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // 2. Target character portrait state
  const [selectedPresetId, setSelectedPresetId] = useState("av_1");
  const [customPortraitPath, setCustomPortraitPath] = useState<string | null>(null);
  const [uploadingPortrait, setUploadingPortrait] = useState(false);
  const portraitInputRef = useRef<HTMLInputElement>(null);

  // 3. Wan2.2-Animate & Audio/Subtitle params
  const [animateMode, setAnimateMode] = useState<"replace" | "move">("replace");
  const [resolution, setResolution] = useState<"720p" | "480p">("720p");
  const [useRelighting, setUseRelighting] = useState(true);
  const [audioMode, setAudioMode] = useState<"tts_replace" | "keep_original">("tts_replace");
  const [scriptText, setScriptText] = useState("");
  const [voiceName, setVoiceName] = useState("zh-CN-XiaoxiaoNeural");
  const [subtitleStyle, setSubtitleStyle] = useState("douyin_yellow");

  // 4. Async Task Progress State
  const [taskStatus, setTaskStatus] = useState<AvatarTaskStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const activePreset = PRESET_AVATARS.find((p) => p.id === selectedPresetId) || PRESET_AVATARS[0];

  // Poll async task while RUNNING
  useEffect(() => {
    if (!taskStatus || taskStatus.status !== "RUNNING") return;
    const timer = window.setInterval(async () => {
      try {
        const next = await api.getAvatarTask(taskStatus.task_id);
        setTaskStatus(next);
        if (next.status !== "RUNNING") {
          window.clearInterval(timer);
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [taskStatus?.task_id, taskStatus?.status]);

  const handleParseLink = async () => {
    if (!shareUrl.trim()) return;
    setParsing(true);
    setErrorMsg("");
    try {
      const res = await api.parseBenchmarkVideo({ share_url: shareUrl.trim() });
      setParsed(res);
      setScriptText(res.rewritten_script);
    } catch (e) {
      setErrorMsg("链接解析失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setParsing(false);
    }
  };

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    setErrorMsg("");
    try {
      const up = await api.uploadAvatarMedia(file, "video");
      const res = await api.parseBenchmarkVideo({ local_video_path: up.file_path });
      setParsed(res);
      setScriptText(res.rewritten_script);
    } catch (err) {
      setErrorMsg("视频上传解析失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingVideo(false);
      e.target.value = "";
    }
  };

  const handleUploadPortrait = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPortrait(true);
    setErrorMsg("");
    try {
      const up = await api.uploadAvatarMedia(file, "image");
      setCustomPortraitPath(up.file_path);
    } catch (err) {
      setErrorMsg("人物照片上传失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingPortrait(false);
      e.target.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!parsed?.local_video_path) {
      setErrorMsg("请先在第 1 步粘贴视频链接解析，或上传一段本地 MP4 原视频");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      const payload = {
        text: scriptText.trim() || parsed.rewritten_script,
        voice_name: voiceName,
        audio_mode: audioMode,
        driving_video_path: parsed.local_video_path,
        face_image_path: customPortraitPath || activePreset.imageUrl,
        animate_mode: animateMode,
        backend_preference: enginesData?.settings.active_backend || "auto",
        resolution,
        use_relighting_lora: useRelighting,
        avatar_name: customPortraitPath ? "自定义人物" : activePreset.name,
        avatar_tag: activePreset.tag,
        sub_mode: animateMode,
        subtitle_style: subtitleStyle,
      };
      const res = await api.submitAvatarTask(payload);
      const initial = await api.getAvatarTask(res.task_id);
      setTaskStatus(initial);
    } catch (e) {
      setErrorMsg("任务提交失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAsset = async (videoPath: string) => {
    try {
      await api.saveAsset({
        file_path: videoPath,
        kind: "video",
        title: `Wan2.2人物替换 · ${parsed?.title.slice(0, 18) || "实景成片"}`,
        meta: { operator: "op_digital_human", mode: animateMode },
      });
      alert("已存入素材库与 CAS 内容寻址存储！");
    } catch (e) {
      alert("存入失败: " + String(e));
    }
  };

  const stageIndex = (stage?: string) => {
    if (!stage || stage === "queued" || stage === "preprocess") return 0;
    if (stage === "wan_animate") return 1;
    if (stage === "postprocess") return 2;
    if (stage === "done") return 3;
    return 0;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ==================== LEFT COLUMN: SOURCE + CHARACTER + PARAMS (5 cols) ==================== */}
      <div className="lg:col-span-5 space-y-4">
        {/* Step 1: Source Video Link or Upload */}
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-apple-blue" />
              <span>1. 输入原视频（保留场景与动作）</span>
            </div>
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={uploadingVideo}
              className="text-[11px] font-semibold text-apple-blue hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              <span>{uploadingVideo ? "上传解析中..." : "上传本地 MP4"}</span>
            </button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={handleUploadVideo}
              className="hidden"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="w-3.5 h-3.5 text-ink-subtle absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={shareUrl}
                onChange={(e) => setShareUrl(e.target.value)}
                placeholder="粘贴抖音/快手/小红书分享口令或 MP4 链接..."
                className="w-full text-xs pl-8 pr-2.5 py-2 rounded-lg border border-border-subtle bg-canvas text-ink"
              />
            </div>
            <button
              onClick={handleParseLink}
              disabled={parsing || !shareUrl.trim()}
              className="px-3.5 py-2 bg-ink text-surface text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 shrink-0"
            >
              {parsing ? "解析中..." : "解析链接"}
            </button>
          </div>

          {parsed && (
            <div className="p-2.5 rounded-lg bg-canvas border border-border-subtle space-y-2">
              <div className="flex items-center gap-2.5">
                {parsed.scene_preview_image ? (
                  <img
                    src={getStreamUrl(parsed.scene_preview_image)}
                    alt="Scene preview"
                    className="w-12 h-16 rounded object-cover bg-black shrink-0 border border-border-subtle"
                  />
                ) : (
                  <div className="w-12 h-16 rounded bg-surface-muted shrink-0 flex items-center justify-center">
                    <Film className="w-4 h-4 text-ink-subtle" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-xs font-semibold text-ink truncate">{parsed.title}</div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span
                      className={`px-1.5 py-0.5 rounded font-medium ${
                        parsed.download_succeeded
                          ? "bg-apple-green/10 text-apple-green"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {parsed.download_succeeded ? "原片实景已锁定" : "链接受限 · 建议上传MP4"}
                    </span>
                    <span className="text-ink-muted">时长 {parsed.duration_sec}s</span>
                  </div>
                </div>
              </div>
              {parsed.warning_note && (
                <div className="p-2 rounded bg-amber-500/10 text-amber-700 text-[11px] flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{parsed.warning_note}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Target Character Portrait */}
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-ink flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-apple-blue" />
              <span>2. 选择或上传目标人物照片</span>
            </div>
            <button
              onClick={() => portraitInputRef.current?.click()}
              disabled={uploadingPortrait}
              className="text-[11px] font-semibold text-apple-blue hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              <span>{uploadingPortrait ? "上传中..." : "上传自定义人物照"}</span>
            </button>
            <input
              ref={portraitInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleUploadPortrait}
              className="hidden"
            />
          </div>

          {customPortraitPath && (
            <div className="p-2 rounded-lg border border-apple-blue bg-apple-blue/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={getStreamUrl(customPortraitPath)}
                  alt="Custom portrait"
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-apple-blue">已使用自定义人物正面照</div>
                  <div className="text-[10px] text-ink-muted truncate">将以此人物替换原视频中的出镜者</div>
                </div>
              </div>
              <button
                onClick={() => setCustomPortraitPath(null)}
                className="text-[11px] text-ink-muted hover:text-ink underline cursor-pointer shrink-0"
              >
                改用预设
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {PRESET_AVATARS.map((av) => {
              const selected = !customPortraitPath && selectedPresetId === av.id;
              return (
                <div
                  key={av.id}
                  onClick={() => {
                    setCustomPortraitPath(null);
                    setSelectedPresetId(av.id);
                    setVoiceName(av.voice);
                  }}
                  className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                    selected
                      ? "border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue"
                      : "border-border-subtle bg-canvas hover:border-ink-muted/30"
                  }`}
                >
                  <img src={av.imageUrl} alt={av.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-ink truncate">{av.name}</div>
                    <div className="text-[10px] text-ink-muted truncate">{av.tag}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Wan2.2-Animate Mode & Audio/Subtitles */}
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="text-xs font-bold text-ink flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-apple-blue" />
            <span>3. Wan2.2-Animate 模式与声音字幕</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAnimateMode("replace")}
              className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                animateMode === "replace"
                  ? "border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue"
                  : "border-border-subtle bg-canvas"
              }`}
            >
              <div className="text-xs font-bold text-ink">人物替换 (Replace)</div>
              <div className="text-[10px] text-ink-muted mt-0.5">原视频场景与光影不变，只换人</div>
            </button>
            <button
              onClick={() => setAnimateMode("move")}
              className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                animateMode === "move"
                  ? "border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue"
                  : "border-border-subtle bg-canvas"
              }`}
            >
              <div className="text-xs font-bold text-ink">动作迁移 (Move)</div>
              <div className="text-[10px] text-ink-muted mt-0.5">将驱动视频动作迁移至目标人物</div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-ink-muted block mb-1">分辨率</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as "720p" | "480p")}
                className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
              >
                <option value="720p">720P 高清 (推荐)</option>
                <option value="480p">480P 极速省算力</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-muted block mb-1">字幕样式</label>
              <select
                value={subtitleStyle}
                onChange={(e) => setSubtitleStyle(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
              >
                <option value="douyin_yellow">抖音高燃金黄描边</option>
                <option value="clean_white">纯净白字阴影</option>
                <option value="none">不压制字幕</option>
              </select>
            </div>
          </div>

          {animateMode === "replace" && (
            <label className="flex items-center justify-between text-xs text-ink cursor-pointer">
              <span>启用 Relighting LoRA（自动融合原场景光照）</span>
              <input
                type="checkbox"
                checked={useRelighting}
                onChange={(e) => setUseRelighting(e.target.checked)}
                className="w-4 h-4 accent-apple-blue"
              />
            </label>
          )}

          {/* Audio Mode */}
          <div className="pt-2 border-t border-border-subtle space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-apple-blue" /> 声音轨道
              </span>
              <div className="flex gap-1.5">
                {[
                  { id: "tts_replace", label: "新文案配音" },
                  { id: "keep_original", label: "保留原声" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setAudioMode(m.id as "tts_replace" | "keep_original")}
                    className={`px-2 py-0.5 rounded text-[11px] border cursor-pointer ${
                      audioMode === m.id
                        ? "border-apple-blue bg-apple-blue/10 text-apple-blue font-semibold"
                        : "border-border-subtle text-ink-muted bg-canvas"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {audioMode === "tts_replace" && (
              <>
                <textarea
                  rows={3}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="输入口播台词（解析原片后会自动生成洗稿文案，可自由修改）..."
                  className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-canvas text-ink resize-none"
                />
                <select
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
                >
                  <option value="zh-CN-XiaoxiaoNeural">晓晓 · 亲和自然女声 (Edge-TTS 免费)</option>
                  <option value="zh-CN-YunxiNeural">云希 · 沉稳专业男声 (Edge-TTS 免费)</option>
                  <option value="zh-CN-YunjianNeural">云健 · 商业深度男声 (Edge-TTS 免费)</option>
                  <option value="zh-HK-HiuMaanNeural">晓曼 · 港风粤语女声 (Edge-TTS 免费)</option>
                </select>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600">
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={submitting || taskStatus?.status === "RUNNING"}
            className="w-full py-3 rounded-lg bg-ink text-surface text-xs font-semibold shadow-soft flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting || taskStatus?.status === "RUNNING" ? (
              <Loader2 className="w-4 h-4 animate-spin text-apple-blue" />
            ) : (
              <Sparkles className="w-4 h-4 text-apple-blue" />
            )}
            <span>
              {taskStatus?.status === "RUNNING"
                ? "正在执行生成管线..."
                : animateMode === "replace"
                ? "开始人物替换（保持原场景不变）"
                : "开始动作迁移生成成片"}
            </span>
          </button>
        </div>
      </div>

      {/* ==================== RIGHT COLUMN: PROGRESS + SIDE-BY-SIDE COMPARE (7 cols) ==================== */}
      <div className="lg:col-span-7 space-y-4">
        {/* Progress Stepper Card */}
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">生成流水线状态</span>
            <button
              onClick={onOpenSettings}
              className="text-[11px] text-apple-blue hover:underline cursor-pointer"
            >
              当前引擎：{enginesData?.resolved_label || "检测中..."} · 切换
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {STAGES.map((st, idx) => {
              const cur = stageIndex(taskStatus?.stage);
              const done = taskStatus?.status === "SUCCEEDED" || (taskStatus && idx < cur);
              const active = taskStatus?.status === "RUNNING" && idx === cur;
              return (
                <div
                  key={st.key}
                  className={`p-2 rounded-lg border text-[11px] font-medium text-center transition-all ${
                    done
                      ? "border-apple-green/40 bg-apple-green/10 text-apple-green"
                      : active
                      ? "border-apple-blue bg-apple-blue/10 text-apple-blue animate-pulse"
                      : "border-border-subtle bg-canvas text-ink-muted"
                  }`}
                >
                  {st.label}
                </div>
              );
            })}
          </div>

          {taskStatus && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-ink font-medium">{taskStatus.message}</span>
                <span className="text-apple-blue font-semibold">
                  {Math.round((taskStatus.progress || 0) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    taskStatus.status === "FAILED"
                      ? "bg-red-500"
                      : taskStatus.status === "SUCCEEDED"
                      ? "bg-apple-green"
                      : "bg-apple-blue"
                  }`}
                  style={{ width: `${Math.max(5, Math.round((taskStatus.progress || 0) * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Side-by-Side Comparison Player */}
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">原片实景 vs 替换成片对比预览</span>
            {taskStatus?.result?.video_path && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveAsset(taskStatus.result!.video_path)}
                  className="px-2.5 py-1 rounded border border-border-subtle bg-canvas text-xs text-ink hover:bg-surface-muted flex items-center gap-1 cursor-pointer"
                >
                  <FolderArchive className="w-3.5 h-3.5" /> 存入素材库
                </button>
                <a
                  href={getStreamUrl(taskStatus.result.video_path, true)}
                  download="wan22-animate-output.mp4"
                  className="px-3 py-1 rounded bg-apple-blue text-surface text-xs font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> 下载 MP4
                </a>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Left: Original Source Video */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-ink-muted">原视频实景参考</div>
              {parsed?.local_video_path ? (
                <video
                  key={parsed.local_video_path}
                  src={getStreamUrl(parsed.local_video_path)}
                  controls
                  muted
                  className="w-full h-[360px] rounded-lg bg-black object-contain border border-border-subtle"
                />
              ) : (
                <div className="h-[360px] rounded-lg border-2 border-dashed border-border-subtle bg-canvas flex flex-col items-center justify-center text-center p-4 space-y-1.5">
                  <Film className="w-8 h-8 text-ink-subtle" />
                  <div className="text-xs font-medium text-ink">尚未导入原视频</div>
                  <div className="text-[11px] text-ink-muted">
                    在左侧粘贴链接解析或上传本地 MP4 后将在此展示原片
                  </div>
                </div>
              )}
            </div>

            {/* Right: Replaced Output Video */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-apple-green flex items-center gap-1">
                {taskStatus?.result ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                <span>人物替换成片输出</span>
              </div>
              {taskStatus?.result?.video_path ? (
                <video
                  key={taskStatus.result.video_path}
                  src={getStreamUrl(taskStatus.result.video_path)}
                  controls
                  autoPlay
                  className="w-full h-[360px] rounded-lg bg-black object-contain border border-apple-green/40 shadow-soft"
                />
              ) : (
                <div className="h-[360px] rounded-lg border-2 border-dashed border-border-subtle bg-canvas flex flex-col items-center justify-center text-center p-4 space-y-1.5">
                  <Sparkles className="w-8 h-8 text-ink-subtle" />
                  <div className="text-xs font-medium text-ink">等待生成成片</div>
                  <div className="text-[11px] text-ink-muted max-w-[220px]">
                    选择目标人物与口播台词，点击「开始人物替换」即可保留原片场景生成新视频
                  </div>
                </div>
              )}
            </div>
          </div>

          {taskStatus?.result && (
            <div className="p-2.5 rounded-lg bg-canvas border border-border-subtle flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-ink-muted">
                执行引擎：<strong className="text-ink">{taskStatus.result.engine_note}</strong>
              </span>
              <span className="text-ink-muted">
                时长：{taskStatus.result.duration_sec}s · 模式：{taskStatus.result.mode}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
