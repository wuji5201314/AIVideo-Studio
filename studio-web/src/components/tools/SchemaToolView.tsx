import React, { useRef, useState } from "react";
import { Play, Pause, Sparkles, FolderArchive, ArrowRight, Video, CheckCircle2, Volume2 } from "lucide-react";
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

export const SchemaToolView: React.FC<SchemaToolViewProps> = ({
  toolName,
  description,
  operatorId = "op_voice_tts",
  isFreeLocal,
  onSendToWorkbench,
  onAssetSaved,
}) => {
  const [inputText, setInputText] = useState<string>("欢迎体验新一代 AI 视频工作台，零成本极速出片。");
  const [voiceName, setVoiceName] = useState<string>("zh-HK-HiuMaanNeural");
  const [aspectRatio, setAspectRatio] = useState<string>("9:16");
  const [outputMedia, setOutputMedia] = useState<string | null>(null);
  const [outputShots, setOutputShots] = useState<ShotItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingAsset, setSavingAsset] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const detectMediaType = (path: string | null): "audio" | "video" | "image" | "script" => {
    if (!path) return outputShots ? "script" : "audio";
    const lower = path.toLowerCase();
    if (lower.endsWith(".mp3") || lower.endsWith(".wav")) return "audio";
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image";
    return "video";
  };

  const handleRunTool = async () => {
    setLoading(true);
    setSavedSuccess(false);
    setIsPlaying(false);
    setStatusMsg("正在通过本地算子极速生成...");
    try {
      let inputPayload: Record<string, unknown> = {};
      let targetOpId = operatorId;

      if (targetOpId === "op_voice_tts") {
        inputPayload = {
          text: inputText,
          voice_name: voiceName,
          rate: "+0%",
          volume: "+0%",
        };
      } else if (targetOpId === "op_motion_text") {
        inputPayload = {
          lines: inputText.split(/\r?\n/).filter((l) => l.trim().length > 0),
          template: "floating",
          theme: "apple_dark",
          aspect_ratio: aspectRatio,
          duration_sec: 5.0,
        };
      } else if (targetOpId === "op_script_storyboard") {
        inputPayload = {
          prompt: inputText,
          shot_count: 4,
        };
      } else {
        targetOpId = "op_voice_tts";
        inputPayload = {
          text: inputText,
          voice_name: voiceName,
          rate: "+0%",
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
        setStatusMsg("生成成功！可直接点击播放、存入素材库或送入成片工作台。");
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMsg("生成失败：" + msg);
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
      console.error("Playback error:", err);
      setStatusMsg("播放失败，请检查音频/视频文件是否有效：" + String(err));
    }
  };

  const handleSaveToLibrary = async () => {
    if (!outputMedia && !outputShots) {
      setStatusMsg("请先点击「立即生成」产出结果后再存入素材库。");
      return;
    }
    setSavingAsset(true);
    try {
      const kind = detectMediaType(outputMedia);
      const shortTitle = `${toolName} · ${inputText.trim().slice(0, 14)}`;
      await api.saveAsset({
        file_path: outputMedia || undefined,
        kind,
        title: shortTitle,
        meta: {
          prompt: inputText,
          voice_name: voiceName,
          aspect_ratio: aspectRatio,
          operator_id: operatorId,
          shots: outputShots || undefined,
        },
      });
      setSavedSuccess(true);
      setStatusMsg("✓ 已成功存入素材库！可在左侧「素材库」中随时预览与复用。");
      onAssetSaved?.();
    } catch (err) {
      console.error("Save asset error:", err);
      setStatusMsg("存入素材库失败：" + String(err));
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

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">核心文本 / 提示词</label>
              <textarea
                rows={4}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full text-xs p-3 rounded-md border border-border-subtle focus:border-apple-blue focus:outline-none bg-canvas text-ink resize-none leading-relaxed"
                placeholder="输入想要合成的文案或画面描述..."
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">合成音色</label>
              <select
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-border-subtle focus:border-apple-blue focus:outline-none bg-surface text-ink"
              >
                <option value="zh-CN-YunxiNeural">云希 (阳光男声 · 爆款口播推荐)</option>
                <option value="zh-CN-XiaoxiaoNeural">晓晓 (温柔女声 · 情感带货)</option>
                <option value="zh-CN-YunjianNeural">云健 (沉稳解说 · 影视科普)</option>
                <option value="zh-CN-liaoning-XiaobeiNeural">东北小贝 (特色方言)</option>
                <option value="zh-HK-HiuMaanNeural">粤语晓曼 (港风口播)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1.5">输出画幅</label>
              <div className="grid grid-cols-3 gap-2">
                {["9:16", "16:9", "1:1"].map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-2 text-xs font-medium rounded-md border transition-all ${
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
          </div>
        </div>

        <div className="pt-6 border-t border-border-subtle">
          <button
            onClick={handleRunTool}
            disabled={loading || !inputText.trim()}
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
      <div className="flex-1 p-8 flex flex-col items-center justify-center bg-canvas">
        <div className="w-full max-w-lg bg-surface border border-border-subtle rounded-apple-lg shadow-card p-6 flex flex-col items-center text-center">
          <div className="w-full min-h-[240px] bg-surface-muted rounded-apple border border-border-subtle flex flex-col items-center justify-center mb-6 overflow-hidden relative p-4">
            {outputMedia && mediaType === "audio" ? (
              <div className="w-full text-xs text-ink space-y-3 flex flex-col items-center">
                <button
                  onClick={handleTogglePlay}
                  title={isPlaying ? "点击暂停" : "点击播放"}
                  className="w-14 h-14 rounded-full bg-apple-green/15 hover:bg-apple-green/25 text-apple-green flex items-center justify-center mx-auto transition-all shadow-soft cursor-pointer active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  )}
                </button>
                <div>
                  <p className="font-semibold text-ink flex items-center justify-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-apple-green" />
                    <span>{isPlaying ? "正在播放配音产物..." : "产物已成功生成（点击上方按钮播放）"}</span>
                  </p>
                  <p className="text-[11px] text-ink-muted font-mono truncate max-w-sm mt-1">
                    {outputMedia}
                  </p>
                </div>
                <audio
                  ref={audioRef}
                  src={streamUrl}
                  controls
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full max-w-sm h-9 mt-2"
                />
              </div>
            ) : outputMedia && mediaType === "video" ? (
              <div className="w-full space-y-2 flex flex-col items-center">
                <video
                  ref={videoRef}
                  src={streamUrl}
                  controls
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full max-h-56 rounded bg-black object-contain"
                />
                <p className="text-[11px] text-ink-muted font-mono truncate max-w-sm">{outputMedia}</p>
              </div>
            ) : outputMedia && mediaType === "image" ? (
              <div className="w-full space-y-2 flex flex-col items-center">
                <img
                  src={streamUrl}
                  alt={toolName}
                  className="w-full max-h-56 rounded object-contain border border-border-subtle"
                />
                <p className="text-[11px] text-ink-muted font-mono truncate max-w-sm">{outputMedia}</p>
              </div>
            ) : outputShots ? (
              <div className="w-full text-left space-y-2 max-h-60 overflow-y-auto pr-1">
                <div className="text-xs font-semibold text-apple-blue mb-1">
                  ✓ 已生成 {outputShots.length} 个结构化分镜
                </div>
                {outputShots.map((s, i) => (
                  <div key={s.shot_id} className="p-2.5 bg-surface rounded border border-border-subtle text-xs">
                    <div className="font-semibold text-ink">#{i + 1} {s.headline}</div>
                    <div className="text-ink-muted text-[11px] mt-0.5">{s.narration}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-ink-subtle flex flex-col items-center gap-2">
                <Video className="w-8 h-8 opacity-40" />
                <span className="text-xs">点击左侧「立即生成」在此处实时预览并播放效果</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full">
            <button
              onClick={handleSaveToLibrary}
              disabled={savingAsset || (!outputMedia && !outputShots)}
              className={`flex-1 py-2.5 px-3 text-xs font-medium rounded-md border shadow-card flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                savedSuccess
                  ? "bg-apple-green/10 border-apple-green/40 text-apple-green"
                  : "bg-surface hover:bg-surface-muted text-ink border-border-subtle"
              }`}
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-apple-green" />
                  <span>已存入素材库</span>
                </>
              ) : (
                <>
                  <FolderArchive className="w-3.5 h-3.5 text-ink-muted" />
                  <span>{savingAsset ? "正在存入..." : "存入素材库"}</span>
                </>
              )}
            </button>
            <button
              onClick={handleSendToWorkbench}
              className="flex-1 py-2.5 px-3 bg-surface hover:bg-apple-blue/5 hover:border-apple-blue/40 text-ink text-xs font-medium rounded-md border border-border-subtle shadow-card flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5 text-apple-blue" />
              <span>送入成片工作台</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
