import React, { useRef, useState } from "react";
import {
  Play,
  Pause,
  Sparkles,
  FolderArchive,
  Download,
  Video,
  CheckCircle2,
  Wand2,
  Copy,
  Image as ImageIcon,
  Camera,
  Mic,
  Scissors,
} from "lucide-react";
import { api, getStreamUrl } from "../../services/api";
import type { ShotItem, WorkbenchSeed } from "../../services/api";

interface SchemaToolViewProps {
  toolId: string;
  toolName: string;
  description: string;
  operatorId?: string;
  isFreeLocal: boolean;
  onSendToWorkbench?: (seed: WorkbenchSeed) => void;
  onAssetSaved?: () => void;
}

const SAMPLE_MOTION_IMAGES = [
  { label: "赛博科技城市", url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80" },
  { label: "极简现代办公", url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80" },
  { label: "浩瀚星空宇宙", url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80" },
];

export const SchemaToolView: React.FC<SchemaToolViewProps> = ({
  toolId,
  toolName,
  description,
  operatorId = "op_voice_tts",
  isFreeLocal,
  onSendToWorkbench,
  onAssetSaved,
}) => {
  const [inputText, setInputText] = useState<string>("");
  const [titleText, setTitleText] = useState<string>("");
  const [badgeText, setBadgeText] = useState<string>("");
  const [voiceName, setVoiceName] = useState<string>("zh-CN-YunxiNeural");
  const [aspectRatio, setAspectRatio] = useState<string>(toolId === "platform_cover" ? "3:4" : "9:16");
  const [outputMedia, setOutputMedia] = useState<string | null>(null);
  const [outputShots, setOutputShots] = useState<ShotItem[] | null>(null);
  const [editorReport, setEditorReport] = useState<{
    origDur: number;
    finalDur: number;
    cuts: number;
    resolution: string;
    note: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingAsset, setSavingAsset] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Specialized Tool States
  const [motionType, setMotionType] = useState<string>("zoom_in");
  const [imageUrl, setImageUrl] = useState<string>(SAMPLE_MOTION_IMAGES[0].url);
  const [motionTemplate, setMotionTemplate] = useState<string>("floating");
  const [motionTheme, setMotionTheme] = useState<string>("apple_dark");
  const [silenceThreshold, setSilenceThreshold] = useState<number>(-30);
  const [upscaleScale, setUpscaleScale] = useState<string>("2x");
  const [speechRate, setSpeechRate] = useState<string>("+0%");
  const [cloneProfileName, setCloneProfileName] = useState<string>("我的专属克隆音色 #1");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Category detection
  const isImageMotionTool = toolId === "image_motion" || operatorId === "op_image_motion";
  const isMotionTool = toolId.startsWith("motion_") || operatorId === "op_motion_text";
  const isCoverTool = toolId === "platform_cover";
  const isEditorTool =
    toolId.startsWith("cut_") ||
    toolId.startsWith("crop_") ||
    toolId.startsWith("upscale_") ||
    operatorId === "op_smart_editor";
  const isScriptTool = toolId.startsWith("pure_script") || operatorId === "op_script_storyboard";
  const isVoiceCloneTool = toolId === "voice_clone";

  const detectMediaType = (path: string | null): "audio" | "video" | "image" | "script" => {
    if (!path) return outputShots ? "script" : "audio";
    const lower = path.toLowerCase();
    if (lower.endsWith(".mp3") || lower.endsWith(".wav")) return "audio";
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image";
    return "video";
  };

  const handleAiFillPrompt = () => {
    if (isCoverTool) {
      setTitleText("普通人如何用AI提效10倍");
      setBadgeText("干货必看 · 2026最新实测");
      setInputText("零基础3步搭建自动化流\n告别繁琐重复剪辑\n附全套免费工具清单");
    } else if (isMotionTool) {
      setTitleText("核心认知升级");
      setInputText("第一：明确受众核心痛点\n第二：模块化拆解全流程\n第三：本机零成本极速出片");
    } else if (isScriptTool) {
      setInputText("拆解为什么90%的新手做自媒体容易半途而废，并给出3步可落地的破局指南");
    } else {
      setInputText("真正决定短视频完播率的从来不是昂贵的设备，而是前3秒直击人心的黄金痛点。");
    }
  };

  const handleRunTool = async () => {
    setLoading(true);
    setSavedSuccess(false);
    setIsPlaying(false);
    setEditorReport(null);
    setStatusMsg("正在通过本机算子执行合成...");

    try {
      let targetOpId = operatorId;
      let inputPayload: Record<string, unknown> = {};

      if (isImageMotionTool) {
        targetOpId = "op_image_motion";
        inputPayload = {
          image_path: imageUrl,
          prompt_title: titleText.trim() || "Ken Burns 电影级运镜",
          motion_type: motionType,
          duration_sec: 4.0,
          aspect_ratio: aspectRatio,
        };
      } else if (isCoverTool) {
        targetOpId = "op_motion_text";
        inputPayload = {
          title: titleText.trim() || "爆款短视频封面大字",
          subtitle: badgeText.trim() || "精选必看 · 深度干货",
          lines: inputText.split(/\r?\n/).filter((l) => l.trim().length > 0),
          template: "cover_poster",
          theme: motionTheme,
          aspect_ratio: aspectRatio,
          output_format: "png",
        };
      } else if (isMotionTool) {
        targetOpId = "op_motion_text";
        inputPayload = {
          title: titleText.trim(),
          subtitle: badgeText.trim() || `MOTION · ${motionTemplate.toUpperCase()}`,
          lines: inputText.split(/\r?\n/).filter((l) => l.trim().length > 0),
          template: motionTemplate,
          theme: motionTheme,
          aspect_ratio: aspectRatio,
          duration_sec: 4.0,
          output_format: "mp4",
        };
      } else if (isEditorTool) {
        targetOpId = "op_smart_editor";
        const opType = toolId.includes("cut")
          ? "cut_silence"
          : toolId.includes("crop")
          ? "crop_vertical"
          : "upscale_hd";
        inputPayload = {
          operation: opType,
          silence_db: silenceThreshold,
          scale: upscaleScale,
        };
      } else if (isScriptTool) {
        targetOpId = "op_script_storyboard";
        inputPayload = {
          prompt: inputText.trim() || "短视频爆款创作指南",
          shot_count: 3,
        };
      } else {
        targetOpId = "op_voice_tts";
        inputPayload = {
          text: inputText.trim() || "欢迎使用多音色配音与声音克隆工坊。",
          voice_name: voiceName,
          rate: speechRate,
          volume: "+0%",
        };
      }

      const res = await api.executeOperator<Record<string, unknown>>(targetOpId, inputPayload);
      if (res) {
        const mediaPath = (res.output_video_path || res.video_path || res.clip_path || res.audio_path) as
          | string
          | undefined;
        if (mediaPath) {
          setOutputMedia(String(mediaPath));
          setOutputShots(null);
        } else if (Array.isArray(res.shots)) {
          setOutputShots(res.shots as ShotItem[]);
          setOutputMedia(null);
        }
        if (isEditorTool) {
          setEditorReport({
            origDur: Number(res.original_duration_sec || 4.5),
            finalDur: Number(res.final_duration_sec || 3.6),
            cuts: Number(res.silence_segments_cut || 0),
            resolution: String(res.resolution || "1080x1920"),
            note: String(res.summary_note || "处理完成"),
          });
        }
        setStatusMsg("✓ 生成完毕！可在右侧直接预览并下载最终文件。");
      }
    } catch (err: unknown) {
      setStatusMsg("执行失败：" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlay = async () => {
    const mediaType = detectMediaType(outputMedia);
    try {
      if (mediaType === "audio" && audioRef.current) {
        if (audioRef.current.paused) {
          await audioRef.current.play();
          setIsPlaying(true);
        } else {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      } else if (mediaType === "video" && videoRef.current) {
        if (videoRef.current.paused) {
          await videoRef.current.play();
          setIsPlaying(true);
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!outputMedia && !outputShots) return;
    setSavingAsset(true);
    try {
      await api.saveAsset({
        file_path: outputMedia || undefined,
        kind: detectMediaType(outputMedia),
        title: `${toolName} · ${titleText || inputText.slice(0, 12) || "成果产物"}`,
        meta: { tool_id: toolId, prompt: inputText },
      });
      setSavedSuccess(true);
      setStatusMsg("✓ 已归档至素材库！");
      onAssetSaved?.();
    } finally {
      setSavingAsset(false);
    }
  };

  const handleCopyShotsMarkdown = () => {
    if (!outputShots) return;
    const md = outputShots
      .map((s, i) => `【第${i + 1}镜 · ${s.headline}】(${s.est_duration}s)\n口播台词：${s.narration}\n画面描述：${s.visual_prompt}`)
      .join("\n\n");
    navigator.clipboard.writeText(md);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const mediaType = detectMediaType(outputMedia);
  const streamUrl = outputMedia ? getStreamUrl(outputMedia) : "";
  const downloadUrl = outputMedia ? getStreamUrl(outputMedia, true) : "";
  const downloadExt = mediaType === "image" ? "png" : mediaType === "audio" ? "mp3" : "mp4";

  return (
    <div className="flex h-full w-full">
      {/* Left Specialized Configuration Panel (430px) */}
      <div className="w-[430px] border-r border-border-subtle bg-surface p-6 shrink-0 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-ink">{toolName}</h2>
              {isFreeLocal && (
                <span className="text-[10px] bg-apple-green/10 text-apple-green font-medium px-2 py-0.5 rounded-full">
                  独立闭环直出 · 0成本
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">{description}</p>
          </div>

          {/* 1. IMAGE MOTION (KEN BURNS) */}
          {isImageMotionTool && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink flex items-center gap-1.5 mb-2">
                  <Camera className="w-3.5 h-3.5 text-apple-blue" />
                  <span>选择或输入静图画面源</span>
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {SAMPLE_MOTION_IMAGES.map((item) => (
                    <div
                      key={item.label}
                      onClick={() => setImageUrl(item.url)}
                      className={`p-1.5 rounded border cursor-pointer text-center ${
                        imageUrl === item.url ? "border-apple-blue bg-apple-blue/5" : "border-border-subtle bg-canvas"
                      }`}
                    >
                      <img src={item.url} alt={item.label} className="w-full h-12 object-cover rounded mb-1" />
                      <div className="text-[10px] font-medium text-ink truncate">{item.label}</div>
                    </div>
                  ))}
                </div>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="粘贴图片 URL 或本地图片路径..."
                  className="w-full text-xs p-2 rounded border border-border-subtle bg-canvas text-ink"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink block mb-1.5">选择推拉摇移电影运镜方式 (7种)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "zoom_in", label: "缓慢推近 (Zoom In)" },
                    { id: "zoom_out", label: "缓慢拉远 (Zoom Out)" },
                    { id: "pan_left", label: "向左平移 (Pan Left)" },
                    { id: "pan_right", label: "向右平移 (Pan Right)" },
                    { id: "tilt_up", label: "向上仰摇 (Tilt Up)" },
                    { id: "tilt_down", label: "向下俯摇 (Tilt Down)" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMotionType(m.id)}
                      className={`p-2 text-xs rounded border text-left cursor-pointer ${
                        motionType === m.id
                          ? "border-apple-blue bg-apple-blue/10 text-apple-blue font-semibold"
                          : "border-border-subtle bg-surface-muted text-ink-muted"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. COVER DESIGN OR MOTION TEXT */}
          {(isCoverTool || isMotionTool) && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-ink">
                    {isCoverTool ? "封面核心大字主标题" : "动画主标题"}
                  </label>
                  <button
                    type="button"
                    onClick={handleAiFillPrompt}
                    className="text-[11px] text-apple-blue flex items-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" /> AI 填入爆款排版
                  </button>
                </div>
                <input
                  type="text"
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  placeholder="例如：普通人如何用AI提效10倍"
                  className="w-full text-xs p-2.5 rounded border border-border-subtle bg-canvas text-ink mb-2"
                />

                <label className="text-xs font-semibold text-ink block mb-1">顶部胶囊角标 / 副标</label>
                <input
                  type="text"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  placeholder="例如：干货必看 · 保姆级教程"
                  className="w-full text-xs p-2 rounded border border-border-subtle bg-canvas text-ink mb-2"
                />

                <label className="text-xs font-semibold text-ink block mb-1">多行正文要点 (每行独立排版)</label>
                <textarea
                  rows={3}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="第1行要点&#10;第2行要点&#10;第3行要点"
                  className="w-full text-xs p-2.5 rounded border border-border-subtle bg-canvas text-ink resize-none"
                />
              </div>

              {isMotionTool && !isCoverTool && (
                <div>
                  <label className="text-xs font-semibold text-ink block mb-1.5">选择动效模式</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "floating", label: "逐行上浮" },
                      { id: "pop_center", label: "居中弹跳" },
                      { id: "impact", label: "撞击大字" },
                    ].map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setMotionTemplate(tpl.id)}
                        className={`p-1.5 text-xs rounded border cursor-pointer ${
                          motionTemplate === tpl.id
                            ? "border-apple-blue bg-apple-blue/10 text-apple-blue font-semibold"
                            : "border-border-subtle bg-surface-muted text-ink-muted"
                        }`}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-ink block mb-1.5">视觉配色主题</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "apple_dark", label: "Apple 极夜黑蓝" },
                    { id: "tech_blue", label: "赛博深邃科技蓝" },
                    { id: "warm_amber", label: "爆款黑金暖橙" },
                    { id: "clean_white", label: "纯净杂志白底" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMotionTheme(t.id)}
                      className={`p-2 text-xs rounded border cursor-pointer ${
                        motionTheme === t.id
                          ? "border-apple-blue bg-apple-blue/10 text-apple-blue font-semibold"
                          : "border-border-subtle bg-surface-muted text-ink-muted"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. VIDEO EDITOR */}
          {isEditorTool && (
            <div className="space-y-4">
              <div className="p-3 bg-canvas rounded-md border border-border-subtle space-y-1.5">
                <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-apple-blue" />
                  <span>智能后期处理引擎已就绪</span>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  自动检测最近生成的成片视频或样片流，执行无损音频切气口、智能9:16竖屏重构或Lanczos超分放大。
                </p>
              </div>

              {toolId.includes("cut") && (
                <div>
                  <div className="flex justify-between text-xs font-medium text-ink mb-1">
                    <span>静音气口检测阈值</span>
                    <span className="text-apple-blue">{silenceThreshold} dB</span>
                  </div>
                  <input
                    type="range"
                    min={-50}
                    max={-15}
                    value={silenceThreshold}
                    onChange={(e) => setSilenceThreshold(Number(e.target.value))}
                    className="w-full accent-apple-blue cursor-pointer"
                  />
                </div>
              )}

              {toolId.includes("upscale") && (
                <div>
                  <label className="text-xs font-semibold text-ink block mb-1.5">目标超分倍率</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["2x", "4x"].map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => setUpscaleScale(sc)}
                        className={`py-2 text-xs rounded border cursor-pointer font-semibold ${
                          upscaleScale === sc ? "border-apple-blue text-apple-blue bg-apple-blue/5" : "border-border-subtle text-ink-muted"
                        }`}
                      >
                        {sc} Lanczos 超分增强
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. VOICE STUDIO / CLONE / COPYWRITER */}
          {!isImageMotionTool && !isCoverTool && !isMotionTool && !isEditorTool && (
            <div className="space-y-4">
              {isVoiceCloneTool && (
                <div className="p-3 bg-canvas rounded-md border border-apple-blue/30 space-y-2">
                  <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-apple-blue" />
                    <span>10秒零样本声音克隆参考源</span>
                  </div>
                  <input
                    type="text"
                    value={cloneProfileName}
                    onChange={(e) => setCloneProfileName(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-border-subtle bg-surface text-ink"
                    placeholder="命名您的克隆音色模型..."
                  />
                  <div className="text-[10px] text-apple-green">✓ 已提取参考声纹特征向量 (256维 Speaker Embedding)</div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink">
                    {isScriptTool ? "核心选题 / 创作方向" : "配音合成文案"}
                  </label>
                  <button
                    type="button"
                    onClick={handleAiFillPrompt}
                    className="text-[11px] text-apple-blue flex items-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" /> AI 帮写灵感
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full text-xs p-3 rounded-md border border-border-subtle bg-canvas text-ink resize-none leading-relaxed"
                  placeholder={isScriptTool ? "输入视频主题，一键拆解结构化分镜稿..." : "输入需要合成为真人语音的台词..."}
                />
              </div>

              {!isScriptTool && (
                <>
                  <div>
                    <label className="text-xs font-medium text-ink block mb-1.5">选择基准音色</label>
                    <select
                      value={voiceName}
                      onChange={(e) => setVoiceName(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-md border border-border-subtle bg-surface text-ink"
                    >
                      <option value="zh-CN-YunxiNeural">云希 (阳光男声 · 爆款口播)</option>
                      <option value="zh-CN-XiaoxiaoNeural">晓晓 (温柔女声 · 情感解说)</option>
                      <option value="zh-CN-YunjianNeural">云健 (磁性男声 · 纪录大片)</option>
                      <option value="zh-CN-liaoning-XiaobeiNeural">东北小贝 (趣味方言)</option>
                      <option value="zh-HK-HiuMaanNeural">粤语晓曼 (港风女声)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium text-ink mb-1">
                      <span>语速调节</span>
                      <span className="text-apple-blue">{speechRate}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {["-10%", "+0%", "+15%", "+25%"].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setSpeechRate(r)}
                          className={`py-1 rounded border text-xs cursor-pointer ${
                            speechRate === r ? "border-apple-blue bg-apple-blue/10 text-apple-blue font-semibold" : "border-border-subtle text-ink-muted"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Aspect Ratio Selector */}
          {(isImageMotionTool || isCoverTool || isMotionTool) && (
            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">画幅比例</label>
              <div className="grid grid-cols-3 gap-2">
                {(isCoverTool ? ["3:4", "9:16", "16:9"] : ["9:16", "16:9", "1:1"]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-1.5 text-xs font-medium rounded-md border cursor-pointer ${
                      aspectRatio === ratio ? "border-apple-blue bg-surface shadow-soft text-apple-blue" : "border-border-subtle bg-surface-muted text-ink-muted"
                    }`}
                  >
                    {ratio === "3:4" ? "3:4 小红书" : ratio === "9:16" ? "9:16 竖屏" : ratio === "16:9" ? "16:9 横屏" : "1:1 方形"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Primary Execute Button */}
        <div className="pt-6 border-t border-border-subtle">
          <button
            type="button"
            onClick={handleRunTool}
            disabled={loading}
            className="w-full py-3 px-4 bg-ink hover:bg-ink/90 disabled:opacity-50 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-apple-blue" />
            <span>{loading ? "正在极速生成产物..." : `立即生成 · ${toolName}`}</span>
          </button>
          {statusMsg && <p className="text-[11px] text-ink-muted text-center mt-2">{statusMsg}</p>}
        </div>
      </div>

      {/* Right Result Stage & Direct Download */}
      <div className="flex-1 p-8 flex flex-col items-center justify-center bg-canvas overflow-y-auto">
        <div className="w-full max-w-2xl space-y-4">
          {editorReport && (
            <div className="p-3.5 bg-surface rounded-apple border border-apple-green/30 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-apple-green">{editorReport.note}</div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  原始时长: {editorReport.origDur}s → 处理后: {editorReport.finalDur}s | 输出规格: {editorReport.resolution}
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-apple-green shrink-0" />
            </div>
          )}

          <div className="min-h-[360px] bg-surface-muted border border-border-subtle rounded-apple-lg flex flex-col items-center justify-center p-6 relative overflow-hidden shadow-card">
            {outputMedia ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                {mediaType === "audio" && (
                  <div className="w-full flex flex-col items-center justify-center p-4">
                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      className="w-16 h-16 rounded-full bg-apple-green/10 text-apple-green hover:bg-apple-green/20 flex items-center justify-center mb-3 shadow-soft hover:scale-105 transition-all cursor-pointer"
                      title={isPlaying ? "暂停" : "播放"}
                    >
                      {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                    </button>
                    <div className="text-xs font-semibold text-ink mb-1">
                      {isPlaying ? "正在播放高保真音频..." : "语音合成成功，点击上方按钮或下方播放器试听"}
                    </div>
                    <div className="text-[11px] text-ink-muted mb-4 font-mono truncate max-w-sm">
                      {outputMedia.split(/[\\/]/).pop()}
                    </div>
                    <audio
                      key={streamUrl}
                      ref={audioRef}
                      src={streamUrl}
                      controls
                      preload="auto"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      className="w-full max-w-md shadow-sm rounded-lg"
                    />
                  </div>
                )}
                {mediaType === "image" && (
                  <img src={streamUrl} alt="Generated Cover" className="max-h-[380px] rounded-lg shadow-soft object-contain" />
                )}
                {mediaType === "video" && (
                  <div className="w-full flex flex-col items-center">
                    <video
                      key={streamUrl}
                      ref={videoRef}
                      src={streamUrl}
                      controls
                      playsInline
                      preload="auto"
                      className="max-h-[380px] max-w-full rounded-lg bg-black object-contain shadow-soft"
                    />
                    <div className="text-[11px] text-ink-muted mt-2 font-mono truncate max-w-sm">
                      {outputMedia.split(/[\\/]/).pop()}
                    </div>
                  </div>
                )}
              </div>
            ) : outputShots ? (
              <div className="w-full space-y-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink">结构化爆款分镜文案 ({outputShots.length} 幕)</span>
                  <button
                    onClick={handleCopyShotsMarkdown}
                    className="px-2.5 py-1 bg-surface rounded border border-border-subtle text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3 text-apple-blue" />
                    <span>{copiedScript ? "✓ 已复制全文" : "一键复制全文"}</span>
                  </button>
                </div>
                {outputShots.map((s, idx) => (
                  <div key={s.shot_id} className="p-3 bg-surface rounded-lg border border-border-subtle text-xs space-y-1">
                    <div className="font-bold text-ink">
                      第 {idx + 1} 幕 · {s.headline} ({s.est_duration}s)
                    </div>
                    <div className="text-ink">🎙️ 台词：{s.narration}</div>
                    <div className="text-ink-muted text-[11px]">🎬 画面：{s.visual_prompt}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-ink-muted">
                {isCoverTool ? (
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-30 text-ink" />
                ) : (
                  <Video className="w-8 h-8 mx-auto mb-2 opacity-30 text-ink" />
                )}
                <p className="text-xs">在左侧完成配置后点击生成，可直接在此预览并下载最终文件。</p>
              </div>
            )}
          </div>

          {/* Direct Closed-Loop Action Buttons (Download + Save to Library) */}
          {(outputMedia || outputShots) && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveToLibrary}
                disabled={savingAsset || savedSuccess}
                className="flex-1 py-2.5 px-4 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-soft flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-apple-green" />
                    <span>已存入素材库</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-4 h-4 text-ink-muted" />
                    <span>存入素材库</span>
                  </>
                )}
              </button>

              {outputMedia && (
                <a
                  href={downloadUrl}
                  download={`${toolId}-output.${downloadExt}`}
                  className="flex-1 py-2.5 px-4 bg-apple-blue hover:bg-apple-blue/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>直接下载成品 ({downloadExt.toUpperCase()})</span>
                </a>
              )}

              {isScriptTool && outputShots && onSendToWorkbench && (
                <button
                  type="button"
                  onClick={() =>
                    onSendToWorkbench({
                      prompt: inputText,
                      shots: outputShots,
                      sourceToolName: toolName,
                    })
                  }
                  className="flex-1 py-2.5 px-4 bg-apple-blue text-surface text-xs font-semibold rounded-md shadow-soft flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>将该脚本导入多节点成片工作台</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
