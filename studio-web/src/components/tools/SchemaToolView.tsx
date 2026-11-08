import React, { useRef, useState } from "react";
import {
  Play,
  Pause,
  Sparkles,
  FolderArchive,
  ArrowRight,
  Video,
  CheckCircle2,
  Wand2,
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

const AVATAR_MODELS = [
  { id: "avatar_1", name: "极客阿辰", tag: "数码科技 · 沉稳", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" },
  { id: "avatar_2", name: "知性苏老师", tag: "知识科普 · 亲和", img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80" },
  { id: "avatar_3", name: "活力小琳", tag: "电商带货 · 热情", img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80" },
  { id: "avatar_4", name: "商务顾总", tag: "职场财经 · 权威", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80" },
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
  // General State
  const [inputText, setInputText] = useState<string>("");
  const [voiceName, setVoiceName] = useState<string>("zh-CN-YunxiNeural");
  const [aspectRatio, setAspectRatio] = useState<string>("9:16");
  const [outputMedia, setOutputMedia] = useState<string | null>(null);
  const [outputShots, setOutputShots] = useState<ShotItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingAsset, setSavingAsset] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Specialized Tool Parameters
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("avatar_1");
  const [motionTemplate, setMotionTemplate] = useState<string>("floating");
  const [motionTheme, setMotionTheme] = useState<string>("apple_dark");
  const motionDuration = 4.0;
  const [silenceThreshold, setSilenceThreshold] = useState<number>(-30);
  const [upscaleScale, setUpscaleScale] = useState<string>("2x");
  const [speechRate, setSpeechRate] = useState<string>("+0%");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Category detection
  const isAvatarTool = toolId.startsWith("avatar_") || operatorId === "op_digital_human";
  const isMotionTool = toolId.startsWith("motion_") || operatorId === "op_motion_text";
  const isEditorTool = toolId.startsWith("cut_") || toolId.startsWith("crop_") || toolId.startsWith("upscale_") || operatorId === "op_smart_editor";
  const isScriptTool = toolId.startsWith("pure_script") || operatorId === "op_script_storyboard";

  const detectMediaType = (path: string | null): "audio" | "video" | "image" | "script" => {
    if (!path) return outputShots ? "script" : "audio";
    const lower = path.toLowerCase();
    if (lower.endsWith(".mp3") || lower.endsWith(".wav")) return "audio";
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image";
    return "video";
  };

  const handleAiFillPrompt = () => {
    if (isAvatarTool) {
      setInputText("欢迎来到我的频道！今天用30秒带大家看清大模型在日常工作中最实用的落地方法，建议点赞收藏！");
    } else if (isMotionTool) {
      setInputText("全新节点化工作流\n零成本 · 本地极速出片\n告别传统黑盒工具");
    } else if (isScriptTool) {
      setInputText("关于如何用AI做短视频的3大关键痛点拆解与落地指南");
    } else {
      setInputText("在这个信息爆炸的时代，真正能拉开差距的不是工具本身，而是你的工作流思维。");
    }
  };

  const handleRunTool = async () => {
    setLoading(true);
    setSavedSuccess(false);
    setIsPlaying(false);
    setStatusMsg("正在通过本地算子极速运算...");
    try {
      let inputPayload: Record<string, unknown> = {};
      let targetOpId = operatorId;

      if (isEditorTool) {
        targetOpId = "op_smart_editor";
        inputPayload = {
          operation: toolId.includes("cut") ? "cut_silence" : toolId.includes("crop") ? "crop_vertical" : "upscale_hd",
          silence_db: silenceThreshold,
          scale: upscaleScale,
        };
      } else if (isMotionTool) {
        targetOpId = "op_motion_text";
        inputPayload = {
          lines: inputText.split(/\r?\n/).filter((l) => l.trim().length > 0),
          template: motionTemplate,
          theme: motionTheme,
          aspect_ratio: aspectRatio,
          duration_sec: motionDuration,
        };
      } else if (isScriptTool) {
        targetOpId = "op_script_storyboard";
        inputPayload = {
          prompt: inputText.trim() || "新一代 AI 视频工作流",
          shot_count: 3,
        };
      } else {
        targetOpId = "op_voice_tts";
        inputPayload = {
          text: inputText.trim() || "欢迎体验新一代数字工作台。",
          voice_name: voiceName,
          rate: speechRate,
          volume: "+0%",
        };
      }

      const res = await api.executeOperator<Record<string, unknown>>(targetOpId, inputPayload);
      if (res) {
        const mediaPath = (res.audio_path || res.video_path || res.clip_path || res.output_video_path) as string | undefined;
        if (mediaPath) {
          setOutputMedia(String(mediaPath));
          setOutputShots(null);
        } else if (Array.isArray(res.shots)) {
          setOutputShots(res.shots as ShotItem[]);
          setOutputMedia(null);
        }
        setStatusMsg("✓ 算子执行成功！可在右侧预览产物或一键送入工作台。");
      }
    } catch (err: unknown) {
      console.error(err);
      setStatusMsg("生成失败：" + (err instanceof Error ? err.message : String(err)));
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
        title: `${toolName} · 成果产物`,
        meta: { prompt: inputText, voice_name: voiceName, shots: outputShots || undefined },
      });
      setSavedSuccess(true);
      setStatusMsg("✓ 已存入素材库！");
      onAssetSaved?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAsset(false);
    }
  };

  const handleSendToWorkbench = () => {
    if (!onSendToWorkbench) return;
    onSendToWorkbench({
      prompt: inputText,
      voiceName,
      aspectRatio,
      mediaPath: outputMedia || undefined,
      mediaType: detectMediaType(outputMedia),
      shots: outputShots || undefined,
      sourceToolName: toolName,
    });
  };

  const mediaType = detectMediaType(outputMedia);
  const streamUrl = outputMedia ? getStreamUrl(outputMedia) : "";

  return (
    <div className="flex h-full w-full">
      {/* Left Parameters Configuration (420px) */}
      <div className="w-[420px] border-r border-border-subtle bg-surface p-6 shrink-0 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-ink">{toolName}</h2>
              {isFreeLocal && (
                <span className="text-[10px] bg-apple-green/10 text-apple-green font-medium px-2 py-0.5 rounded-full">
                  纯本机免费 · 0成本
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">{description}</p>
          </div>

          {/* DYNAMIC FORM 1: DIGITAL HUMAN */}
          {isAvatarTool && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink block mb-2">选择数字人底模形象</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVATAR_MODELS.map((av) => (
                    <div
                      key={av.id}
                      onClick={() => setSelectedAvatarId(av.id)}
                      className={`p-2 rounded-md border flex items-center gap-2.5 cursor-pointer transition-all ${
                        selectedAvatarId === av.id
                          ? "border-apple-blue bg-apple-blue/5 shadow-soft"
                          : "border-border-subtle bg-surface-muted hover:border-ink-muted/30"
                      }`}
                    >
                      <img src={av.img} alt={av.name} className="w-8 h-8 rounded-full object-cover" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-ink truncate">{av.name}</div>
                        <div className="text-[10px] text-ink-muted truncate">{av.tag}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink">口播台词 / 提示词</label>
                  <button
                    type="button"
                    onClick={handleAiFillPrompt}
                    className="text-[11px] text-apple-blue hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>AI 帮写台词</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md border border-border-subtle focus:border-apple-blue bg-canvas text-ink resize-none"
                  placeholder="输入数字人口播台词..."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink block mb-1.5">匹配口播音色</label>
                <select
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  className="w-full text-xs p-2 rounded-md border border-border-subtle bg-surface text-ink"
                >
                  <option value="zh-CN-YunxiNeural">云希 (阳光男声 · 推荐)</option>
                  <option value="zh-CN-XiaoxiaoNeural">晓晓 (温柔女声)</option>
                  <option value="zh-CN-YunjianNeural">云健 (沉稳解说)</option>
                  <option value="zh-HK-HiuMaanNeural">粤语晓曼 (港风口播)</option>
                </select>
              </div>
            </div>
          )}

          {/* DYNAMIC FORM 2: MOTION DESIGN */}
          {isMotionTool && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink">标题卡文案 (每行独立卡片)</label>
                  <button
                    type="button"
                    onClick={handleAiFillPrompt}
                    className="text-[11px] text-apple-blue hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>生成爆款文案</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md border border-border-subtle focus:border-apple-blue bg-canvas text-ink resize-none"
                  placeholder="第1行：主标题&#10;第2行：高光副标&#10;第3行：行动号召"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink block mb-1.5">动效样式</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "floating", label: "逐行上浮 (Floating)" },
                    { id: "pop_center", label: "居中弹跳 (Pop-in)" },
                    { id: "impact", label: "撞击文字 (Impact)" },
                    { id: "typewriter", label: "打字机 (Typewriter)" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMotionTemplate(m.id)}
                      className={`p-2 text-xs rounded border text-left cursor-pointer transition-all ${
                        motionTemplate === m.id
                          ? "border-apple-blue bg-apple-blue/10 text-apple-blue font-semibold"
                          : "border-border-subtle bg-surface-muted text-ink-muted"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink block mb-1.5">配色视觉主题</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "apple_dark", label: "Apple 深邃黑" },
                    { id: "tech_blue", label: "极客科技蓝" },
                    { id: "clean_white", label: "极简白底" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMotionTheme(t.id)}
                      className={`py-1.5 text-xs rounded border text-center cursor-pointer transition-all ${
                        motionTheme === t.id
                          ? "border-apple-blue bg-surface shadow-soft text-apple-blue font-semibold"
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

          {/* DYNAMIC FORM 3: VIDEO EDITING TOOLS */}
          {isEditorTool && (
            <div className="space-y-4">
              <div className="p-3 bg-canvas rounded-md border border-border-subtle">
                <div className="text-xs font-semibold text-ink mb-1">视频输入源</div>
                <p className="text-[11px] text-ink-muted mb-2">
                  支持从成片工作台导入镜头或对历史素材进行二次智能处理。
                </p>
                <button
                  type="button"
                  className="w-full py-2 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded border border-border-subtle flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5 text-apple-blue" />
                  <span>选择要处理的视频素材</span>
                </button>
              </div>

              {toolId.includes("cut") && (
                <div>
                  <div className="flex justify-between text-xs font-medium text-ink mb-1.5">
                    <span>静音识别门限</span>
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
                  <div className="flex justify-between text-[10px] text-ink-subtle mt-0.5">
                    <span>-50dB (激进切除)</span>
                    <span>-15dB (温和切除)</span>
                  </div>
                </div>
              )}

              {toolId.includes("upscale") && (
                <div>
                  <label className="text-xs font-medium text-ink block mb-1.5">高清超分倍数</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["2x", "4x"].map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => setUpscaleScale(sc)}
                        className={`py-2 text-xs rounded border cursor-pointer font-medium ${
                          upscaleScale === sc
                            ? "border-apple-blue bg-surface shadow-soft text-apple-blue"
                            : "border-border-subtle bg-surface-muted text-ink-muted"
                        }`}
                      >
                        {sc} 超分辨率
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DYNAMIC FORM 4: VOICE STUDIO OR GENERAL TOOLS */}
          {!isAvatarTool && !isMotionTool && !isEditorTool && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink">
                    {isScriptTool ? "核心选题诉求 / 创作方向" : "配音文案 / 台词"}
                  </label>
                  <button
                    type="button"
                    onClick={handleAiFillPrompt}
                    className="text-[11px] text-apple-blue hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>AI 帮写灵感</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full text-xs p-3 rounded-md border border-border-subtle focus:border-apple-blue bg-canvas text-ink resize-none leading-relaxed"
                  placeholder={isScriptTool ? "输入您想拆解的选题主题..." : "输入想要合成的台词文案..."}
                />
              </div>

              {!isScriptTool && (
                <>
                  <div>
                    <label className="text-xs font-medium text-ink block mb-1.5">合成音色</label>
                    <select
                      value={voiceName}
                      onChange={(e) => setVoiceName(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-md border border-border-subtle bg-surface text-ink"
                    >
                      <option value="zh-CN-YunxiNeural">云希 (阳光男声 · 口播推荐)</option>
                      <option value="zh-CN-XiaoxiaoNeural">晓晓 (温柔女声 · 情感带货)</option>
                      <option value="zh-CN-YunjianNeural">云健 (沉稳解说 · 影视科普)</option>
                      <option value="zh-CN-liaoning-XiaobeiNeural">东北小贝 (特色方言)</option>
                      <option value="zh-HK-HiuMaanNeural">粤语晓曼 (港风口播)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium text-ink mb-1">
                      <span>语速微调</span>
                      <span className="text-apple-blue">{speechRate}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-xs">
                      {["-10%", "+0%", "+15%", "+25%"].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setSpeechRate(r)}
                          className={`py-1 rounded border text-xs cursor-pointer ${
                            speechRate === r
                              ? "border-apple-blue bg-apple-blue/10 text-apple-blue font-semibold"
                              : "border-border-subtle bg-surface-muted text-ink-muted"
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

          {/* Aspect Ratio (Common for video/image outputs) */}
          {!isEditorTool && (
            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">输出画幅</label>
              <div className="grid grid-cols-3 gap-2">
                {["9:16", "16:9", "1:1"].map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-1.5 text-xs font-medium rounded-md border transition-all cursor-pointer ${
                      aspectRatio === ratio
                        ? "border-apple-blue bg-surface shadow-soft text-apple-blue"
                        : "border-border-subtle bg-surface-muted text-ink-muted hover:text-ink"
                    }`}
                  >
                    {ratio === "9:16" ? "9:16 竖屏" : ratio === "16:9" ? "16:9 横屏" : "1:1 方形"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Execute Button */}
        <div className="pt-6 border-t border-border-subtle">
          <button
            type="button"
            onClick={handleRunTool}
            disabled={loading || (!isEditorTool && !inputText.trim())}
            className="w-full py-3 px-4 bg-ink hover:bg-ink/90 disabled:opacity-50 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-apple-blue" />
            <span>{loading ? "正在极速生成中..." : "立即生成"}</span>
          </button>
          {statusMsg && (
            <p className="text-[11px] text-ink-muted text-center mt-2.5 leading-snug">{statusMsg}</p>
          )}
        </div>
      </div>

      {/* Right Preview Stage */}
      <div className="flex-1 p-8 flex flex-col items-center justify-center bg-canvas overflow-y-auto">
        <div className="w-full max-w-xl space-y-4">
          <div className="aspect-[16/10] bg-surface-muted border border-border-subtle rounded-apple-lg flex flex-col items-center justify-center p-6 relative overflow-hidden shadow-card">
            {outputMedia ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                {mediaType === "audio" && (
                  <>
                    <audio ref={audioRef} src={streamUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
                    <button
                      onClick={handleTogglePlay}
                      className="w-16 h-16 rounded-full bg-apple-green/10 text-apple-green flex items-center justify-center mb-3 shadow-soft hover:scale-105 transition-all cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                    </button>
                    <div className="text-xs font-semibold text-ink">产物已成功生成</div>
                    <div className="text-[11px] text-ink-subtle mt-1 font-mono truncate max-w-sm">{outputMedia}</div>
                  </>
                )}
                {mediaType === "video" && (
                  <video
                    ref={videoRef}
                    src={streamUrl}
                    controls
                    className="max-h-full max-w-full rounded-md object-contain"
                  />
                )}
              </div>
            ) : outputShots ? (
              <div className="w-full h-full overflow-y-auto space-y-2 p-2">
                <div className="text-xs font-semibold text-ink mb-1">分镜拆解结果 ({outputShots.length} 幕)</div>
                {outputShots.map((s, idx) => (
                  <div key={s.shot_id} className="p-2.5 bg-surface rounded border border-border-subtle text-xs">
                    <div className="font-semibold text-ink">第 {idx + 1} 幕 · {s.headline}</div>
                    <div className="text-ink-muted mt-1">{s.narration}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-ink-muted">
                <Video className="w-8 h-8 mx-auto mb-2 opacity-30 text-ink" />
                <p className="text-xs">配置左侧参数后点击「立即生成」，产物将在此实时呈现与播放。</p>
              </div>
            )}
          </div>

          {/* Action Bar */}
          {(outputMedia || outputShots) && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveToLibrary}
                disabled={savingAsset || savedSuccess}
                className="flex-1 py-2.5 px-4 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-soft flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-apple-green" />
                    <span>已存入素材库</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-4 h-4 text-ink-muted" />
                    <span>{savingAsset ? "保存中..." : "存入素材库"}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSendToWorkbench}
                className="flex-1 py-2.5 px-4 bg-surface hover:bg-surface-muted text-apple-blue text-xs font-medium rounded-md border border-apple-blue/30 shadow-soft flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <span>送入成片工作台</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
