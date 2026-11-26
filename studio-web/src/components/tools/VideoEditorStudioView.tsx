import React, { useRef, useState } from "react";
import {
  Scissors,
  Upload,
  Sparkles,
  Download,
  FolderArchive,
  CheckCircle2,
  Film,
  Loader2,
  Maximize2,
  Smartphone,
} from "lucide-react";
import { api, getStreamUrl } from "../../services/api";

interface VideoEditorStudioViewProps {
  initialToolId: string;
}

interface EditReport {
  outputVideoPath: string;
  origDur: number;
  finalDur: number;
  cuts: number;
  resolution: string;
  note: string;
}

export const VideoEditorStudioView: React.FC<VideoEditorStudioViewProps> = ({ initialToolId }) => {
  const [operation, setOperation] = useState<"cut_silence" | "crop_vertical" | "upscale_hd">(
    initialToolId === "crop_vertical"
      ? "crop_vertical"
      : initialToolId === "upscale_hd"
      ? "upscale_hd"
      : "cut_silence"
  );
  const [sourceVideoPath, setSourceVideoPath] = useState<string>("");
  const [sourceFileName, setSourceFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // Params
  const [silenceDb, setSilenceDb] = useState<number>(-30);
  const [minSilenceSec, setMinSilenceSec] = useState<number>(0.35);
  const [scale, setScale] = useState<"2x" | "4x">("2x");

  // Execution state
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState<EditReport | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg("");
    try {
      const up = await api.uploadAvatarMedia(file, "video");
      setSourceVideoPath(up.file_path);
      setSourceFileName(up.filename);
      setReport(null);
    } catch (err) {
      setErrorMsg("视频上传失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRunEdit = async () => {
    if (!sourceVideoPath) {
      setErrorMsg("请先上传一段需要处理的本地 MP4 / MOV 视频文件");
      return;
    }
    setProcessing(true);
    setErrorMsg("");
    try {
      const res = await api.executeOperator<{
        output_video_path: string;
        original_duration_sec: number;
        final_duration_sec: number;
        silence_segments_cut: number;
        resolution: string;
        summary_note: string;
      }>("op_smart_editor", {
        video_path: sourceVideoPath,
        operation,
        silence_db: silenceDb,
        min_silence_sec: minSilenceSec,
        scale,
      });
      if (res?.output_video_path) {
        setReport({
          outputVideoPath: res.output_video_path,
          origDur: res.original_duration_sec,
          finalDur: res.final_duration_sec,
          cuts: res.silence_segments_cut,
          resolution: res.resolution,
          note: res.summary_note,
        });
      }
    } catch (err) {
      setErrorMsg("处理失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold tracking-tight text-ink">智能视频后期工坊</h1>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-apple-green/10 text-apple-green font-semibold">
            真实本机 FFmpeg 引擎 · 0 费用
          </span>
        </div>
        <p className="text-xs text-ink-muted">
          上传任意本地视频，真实执行静音气口切除（silencedetect + trim/concat）、9:16 智能竖屏裁切与 Lanczos 超分放大
        </p>
      </div>

      {/* Mode Switch */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "cut_silence", label: "口播智能切气口", icon: <Scissors className="w-3.5 h-3.5" /> },
          { id: "crop_vertical", label: "智能转竖屏 (9:16)", icon: <Smartphone className="w-3.5 h-3.5" /> },
          { id: "upscale_hd", label: "画质高清放大 (Lanczos)", icon: <Maximize2 className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setOperation(tab.id as "cut_silence" | "crop_vertical" | "upscale_hd")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
              operation === tab.id
                ? "bg-ink text-surface shadow-soft"
                : "bg-surface text-ink-muted hover:text-ink border border-border-subtle"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Upload & Controls (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
            <div className="text-xs font-bold text-ink">1. 上传待处理视频文件</div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-6 px-4 rounded-lg border-2 border-dashed border-border-subtle hover:border-apple-blue bg-canvas flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Upload className="w-6 h-6 text-apple-blue" />
              <div className="text-xs font-semibold text-ink">
                {uploading ? "正在上传视频..." : sourceFileName ? `已导入：${sourceFileName}` : "点击选择本地 MP4 / MOV 视频"}
              </div>
              <div className="text-[11px] text-ink-muted">纯本机处理，不上传外网服务器</div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
              onChange={handleUpload}
              className="hidden"
            />
          </div>

          <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
            <div className="text-xs font-bold text-ink">2. 参数微调</div>

            {operation === "cut_silence" && (
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-muted">静音判定阈值</span>
                    <span className="font-semibold text-apple-blue">{silenceDb} dB</span>
                  </div>
                  <input
                    type="range"
                    min={-50}
                    max={-15}
                    value={silenceDb}
                    onChange={(e) => setSilenceDb(Number(e.target.value))}
                    className="w-full accent-apple-blue cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-muted">最短切除停顿时长</span>
                    <span className="font-semibold text-apple-blue">{minSilenceSec} 秒</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1.5}
                    step={0.05}
                    value={minSilenceSec}
                    onChange={(e) => setMinSilenceSec(Number(e.target.value))}
                    className="w-full accent-apple-blue cursor-pointer"
                  />
                </div>
              </div>
            )}

            {operation === "crop_vertical" && (
              <div className="text-xs text-ink-muted bg-canvas p-3 rounded-lg border border-border-subtle">
                自动按画面中心构图缩放并无黑边裁切为标准 <strong>1080×1920 (9:16)</strong> 抖音/小红书竖屏比例。
              </div>
            )}

            {operation === "upscale_hd" && (
              <div className="flex gap-2">
                {(["2x", "4x"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                      scale === s
                        ? "border-apple-blue bg-apple-blue/10 text-apple-blue"
                        : "border-border-subtle bg-canvas text-ink-muted"
                    }`}
                  >
                    {s} 高清超分重建
                  </button>
                ))}
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded bg-red-500/10 text-red-600 text-xs">{errorMsg}</div>
            )}

            <button
              onClick={handleRunEdit}
              disabled={processing || !sourceVideoPath}
              className="w-full py-3 rounded-lg bg-ink text-surface text-xs font-semibold shadow-soft flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin text-apple-blue" />
              ) : (
                <Sparkles className="w-4 h-4 text-apple-blue" />
              )}
              <span>{processing ? "正在执行本机 FFmpeg 处理..." : "立即开始处理"}</span>
            </button>
          </div>
        </div>

        {/* Right: Side-by-Side Comparison (8 cols) */}
        <div className="lg:col-span-8 p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">处理前后同屏对比</span>
            {report && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    api
                      .saveAsset({
                        file_path: report.outputVideoPath,
                        kind: "video",
                        title: `智能剪辑 · ${operation}`,
                      })
                      .then(() => alert("已存入素材库"))
                  }
                  className="px-2.5 py-1 rounded border border-border-subtle bg-canvas text-xs text-ink flex items-center gap-1 cursor-pointer"
                >
                  <FolderArchive className="w-3.5 h-3.5" /> 存入素材库
                </button>
                <a
                  href={getStreamUrl(report.outputVideoPath, true)}
                  download={`edited-${operation}.mp4`}
                  className="px-3 py-1 rounded bg-apple-blue text-surface text-xs font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> 下载成品 MP4
                </a>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-ink-muted">原视频</div>
              {sourceVideoPath ? (
                <video
                  key={sourceVideoPath}
                  src={getStreamUrl(sourceVideoPath)}
                  controls
                  className="w-full h-[340px] rounded-lg bg-black object-contain border border-border-subtle"
                />
              ) : (
                <div className="h-[340px] rounded-lg border-2 border-dashed border-border-subtle bg-canvas flex flex-col items-center justify-center text-ink-muted text-xs gap-1.5">
                  <Film className="w-7 h-7 text-ink-subtle" />
                  <span>上传视频后在此预览</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-apple-green flex items-center gap-1">
                {report && <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>处理后成片</span>
              </div>
              {report ? (
                <video
                  key={report.outputVideoPath}
                  src={getStreamUrl(report.outputVideoPath)}
                  controls
                  autoPlay
                  className="w-full h-[340px] rounded-lg bg-black object-contain border border-apple-green/40 shadow-soft"
                />
              ) : (
                <div className="h-[340px] rounded-lg border-2 border-dashed border-border-subtle bg-canvas flex flex-col items-center justify-center text-ink-muted text-xs">
                  等待执行剪辑输出
                </div>
              )}
            </div>
          </div>

          {report && (
            <div className="p-3 rounded-lg bg-canvas border border-border-subtle grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-[10px] text-ink-muted">时长变化</div>
                <div className="font-bold text-ink">
                  {report.origDur}s → <span className="text-apple-green">{report.finalDur}s</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-ink-muted">输出分辨率</div>
                <div className="font-bold text-ink">{report.resolution}</div>
              </div>
              <div>
                <div className="text-[10px] text-ink-muted">执行摘要</div>
                <div className="font-medium text-apple-blue truncate" title={report.note}>
                  {report.note}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
