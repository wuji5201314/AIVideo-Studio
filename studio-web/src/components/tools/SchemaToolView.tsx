import React, { useState } from "react";
import { Play, Sparkles, FolderArchive, ArrowRight, Video } from "lucide-react";
import { api } from "../../services/api";

interface SchemaToolViewProps {
  toolId: string;
  toolName: string;
  description: string;
  operatorId?: string;
  isFreeLocal: boolean;
}

export const SchemaToolView: React.FC<SchemaToolViewProps> = ({
  toolName,
  description,
  operatorId = "op_voice_tts",
  isFreeLocal,
}) => {
  const [inputText, setInputText] = useState<string>("欢迎体验新一代 AI 视频工作台，零成本极速出片。");
  const [voiceName, setVoiceName] = useState<string>("zh-CN-YunxiNeural");
  const [aspectRatio, setAspectRatio] = useState<string>("9:16");
  const [outputMedia, setOutputMedia] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const handleRunTool = async () => {
    setLoading(true);
    setStatusMsg("正在通过本地算子极速生成...");
    try {
      let inputPayload: Record<string, unknown> = {};

      if (operatorId === "op_voice_tts") {
        inputPayload = {
          text: inputText,
          voice_name: voiceName,
          rate: "+0%",
          volume: "+0%",
        };
      } else if (operatorId === "op_motion_text") {
        inputPayload = {
          lines: [inputText],
          template: "floating",
          theme: "apple_dark",
          aspect_ratio: aspectRatio,
          duration_sec: 5.0,
        };
      } else {
        inputPayload = {
          prompt: inputText,
          shot_count: 3,
        };
      }

      const res = await api.executeOperator<Record<string, unknown>>(operatorId, inputPayload);
      if (res) {
        setOutputMedia(String(res.audio_path || res.video_path || "generated_success"));
        setStatusMsg("生成成功！可直接播放或送入素材库。");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("生成失败：" + String(err));
    } finally {
      setLoading(false);
    }
  };

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

            {operatorId === "op_voice_tts" && (
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
            )}

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
            className="w-full py-3 px-4 bg-ink hover:bg-ink/90 disabled:opacity-50 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center justify-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4 text-apple-blue" />
            <span>{loading ? "正在极速生成中..." : "立即生成"}</span>
          </button>
          {statusMsg && (
            <p className="text-[11px] text-ink-muted text-center mt-2.5 truncate">{statusMsg}</p>
          )}
        </div>
      </div>

      {/* Right Preview Stage */}
      <div className="flex-1 p-8 flex flex-col items-center justify-center bg-canvas">
        <div className="w-full max-w-lg bg-surface border border-border-subtle rounded-apple-lg shadow-card p-6 flex flex-col items-center text-center">
          <div className="w-full aspect-video bg-surface-muted rounded-apple border border-border-subtle flex flex-col items-center justify-center mb-6 overflow-hidden relative">
            {outputMedia ? (
              <div className="p-4 text-xs text-ink space-y-2">
                <div className="w-12 h-12 rounded-full bg-apple-green/10 text-apple-green flex items-center justify-center mx-auto mb-2">
                  <Play className="w-6 h-6 fill-current" />
                </div>
                <p className="font-semibold text-ink">产物已成功生成</p>
                <p className="text-[11px] text-ink-muted font-mono truncate max-w-xs">{outputMedia}</p>
              </div>
            ) : (
              <div className="text-ink-subtle flex flex-col items-center gap-2">
                <Video className="w-8 h-8 opacity-40" />
                <span className="text-xs">点击左侧「立即生成」在此处实时预览效果</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full">
            <button className="flex-1 py-2 px-3 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-card flex items-center justify-center gap-1.5 transition-all">
              <FolderArchive className="w-3.5 h-3.5 text-ink-muted" />
              <span>存入素材库</span>
            </button>
            <button className="flex-1 py-2 px-3 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-card flex items-center justify-center gap-1.5 transition-all">
              <ArrowRight className="w-3.5 h-3.5 text-apple-blue" />
              <span>送入成片工作台</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
