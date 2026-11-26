import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Download, FolderArchive, KeyRound, Loader2, Upload, Video } from "lucide-react";
import { api, type CloudApiSettings, getStreamUrl } from "../../services/api";

interface CloudVideoStudioViewProps {
  onOpenApiSettings: () => void;
}

export const CloudVideoStudioView: React.FC<CloudVideoStudioViewProps> = ({ onOpenApiSettings }) => {
  const [apiSettings, setApiSettings] = useState<CloudApiSettings | null>(null);
  const [prompt, setPrompt] = useState(
    "Slow cinematic dolly-in shot of a sunlit minimalist wooden furniture showroom, soft dust motes floating in warm golden hour sunlight, ultra realistic commercial film, 4k"
  );
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [refImagePath, setRefImagePath] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ video_path: string; model_used: string; summary_note: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const imgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getCloudApiSettings().then(setApiSettings).catch(() => null);
  }, []);

  const handleUploadRef = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const up = await api.uploadAvatarMedia(file, "image");
      setRefImagePath(up.file_path);
    } catch (err) {
      setErrorMsg("参考图上传失败: " + String(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.executeOperator<{
        video_path: string;
        model_used: string;
        summary_note: string;
      }>("op_cloud_video", {
        prompt: prompt.trim(),
        image_path: refImagePath || null,
        aspect_ratio: aspectRatio,
      });
      setResult(res);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-ink">AI 电影级视频生成 (文生 / 图生视频)</h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue font-semibold">
              云端 Wan2.2 / OpenAI 兼容 · 0 显存
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            通过云端 API 直接调用 Wan2.2 等顶级视频大模型生成真实电影感镜头，支持纯文生视频与首帧参考图生视频 (I2V)
          </p>
        </div>

        <button
          onClick={onOpenApiSettings}
          className="px-3.5 py-2 rounded-lg border border-border-subtle bg-surface hover:bg-surface-muted text-xs font-semibold text-ink flex items-center gap-2 cursor-pointer self-start"
        >
          <KeyRound className="w-3.5 h-3.5 text-apple-blue" />
          <span>{apiSettings?.video_ready ? `视频模型：${apiSettings.video_model}` : "未配置视频 API Key · 点击配置"}</span>
        </button>
      </div>

      {!apiSettings?.video_ready && (
        <div className="p-4 rounded-apple bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="text-xs text-amber-800">
            <strong>尚未配置视频生成 API Key：</strong>点击右侧前往填写硅基流动 / OneAPI / 中转站 Key，即可免显卡生成电影级 AI 视频。
          </div>
          <button
            onClick={onOpenApiSettings}
            className="px-4 py-2 rounded-lg bg-ink text-surface text-xs font-semibold shrink-0 cursor-pointer"
          >
            立即配置 API Key
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">1. 首帧参考图（可选，上传即为图生视频 I2V）</span>
              <button
                onClick={() => imgInputRef.current?.click()}
                disabled={uploading}
                className="text-[11px] font-semibold text-apple-blue hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>{uploading ? "上传中..." : "上传参考图"}</span>
              </button>
              <input ref={imgInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadRef} className="hidden" />
            </div>

            {refImagePath && (
              <div className="p-2 rounded-lg bg-canvas border border-border-subtle flex items-center justify-between">
                <img src={getStreamUrl(refImagePath)} alt="ref" className="w-12 h-16 rounded object-cover" />
                <button onClick={() => setRefImagePath("")} className="text-xs text-red-500 cursor-pointer">
                  移除参考图（切回文生视频）
                </button>
              </div>
            )}

            <div>
              <label className="text-[11px] text-ink-muted block mb-1">镜头运镜与画面提示词</label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-canvas text-ink resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(["9:16", "16:9"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                    aspectRatio === r
                      ? "border-apple-blue bg-apple-blue/10 text-apple-blue"
                      : "border-border-subtle bg-canvas text-ink-muted"
                  }`}
                >
                  {r === "9:16" ? "9:16 竖屏短视频" : "16:9 横屏大片"}
                </button>
              ))}
            </div>

            {errorMsg && <div className="p-2.5 rounded-lg bg-red-500/10 text-red-600 text-xs">{errorMsg}</div>}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-ink text-surface text-xs font-semibold shadow-soft flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-apple-blue" /> : <Sparkles className="w-4 h-4 text-apple-blue" />}
              <span>{loading ? "云端视频模型渲染中（约 30~90 秒）..." : "立即生成电影级 AI 视频"}</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">AI 成片预览</span>
            {result && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    api
                      .saveAsset({ file_path: result.video_path, kind: "video", title: "AI电影级生成视频" })
                      .then(() => alert("已存入素材库"))
                  }
                  className="px-2.5 py-1 rounded border border-border-subtle bg-canvas text-xs text-ink flex items-center gap-1 cursor-pointer"
                >
                  <FolderArchive className="w-3.5 h-3.5" /> 存入素材库
                </button>
                <a
                  href={getStreamUrl(result.video_path, true)}
                  download="ai-cloud-video.mp4"
                  className="px-3 py-1 rounded bg-apple-blue text-surface text-xs font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> 下载 MP4
                </a>
              </div>
            )}
          </div>

          {result ? (
            <div className="space-y-2">
              <video
                key={result.video_path}
                src={getStreamUrl(result.video_path)}
                controls
                autoPlay
                loop
                className="w-full max-h-[460px] rounded-lg bg-black object-contain"
              />
              <div className="text-[11px] text-ink-muted">{result.summary_note}</div>
            </div>
          ) : (
            <div className="h-[420px] rounded-lg border-2 border-dashed border-border-subtle bg-canvas flex flex-col items-center justify-center text-ink-muted text-xs gap-2">
              <Video className="w-9 h-9 text-ink-subtle" />
              <span>配置视频生成 API Key 后即可在此直接生成高质量电影镜头</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
