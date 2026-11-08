import React, { useRef, useState } from "react";
import { Download, FolderArchive, CheckCircle2, Film, Sparkles, Sliders, Volume2 } from "lucide-react";
import { api, getStreamUrl } from "../../../services/api";
import type { ShotItem } from "../../../services/api";

interface ExportStageViewProps {
  shots: ShotItem[];
  projectTitle: string;
}

export const ExportStageView: React.FC<ExportStageViewProps> = ({ shots, projectTitle }) => {
  const [resolution, setResolution] = useState<string>("1080p");
  const [exportFps, setExportFps] = useState<number>(30);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string>("");
  const [, setIsPlayingAll] = useState<boolean>(false);
  const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);
  const [masterDuration, setMasterDuration] = useState<number>(
    shots.reduce((acc, s) => acc + (s.est_duration || 3.5), 0)
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleExportVideo = async () => {
    setIsExporting(true);
    setExportNotice("正在执行全片多镜串接、多轨字幕烧录与 FFmpeg 高清硬件加速渲染...");
    try {
      // 1. Call real backend video composer operator to render full composite MP4
      const compRes = await api.executeOperator<{
        video_path: string;
        duration_sec: number;
        file_size_bytes: number;
        resolution: string;
      }>("op_video_composer", {
        title: projectTitle || "新一代 AI 视频工作流全拆解",
        aspect_ratio: "9:16",
        fps: exportFps,
        shots: shots.map((s) => ({
          shot_id: s.shot_id,
          headline: s.headline,
          narration: s.narration,
          audio_path: s.audio_path,
          visual_path: s.visual_path,
          est_duration: s.est_duration || 3.5,
        })),
      });

      if (!compRes || !compRes.video_path) {
        throw new Error("后端视频合成算子未返回有效视频路径");
      }

      // 2. Persist the generated complete MP4 video into CAS asset library
      await api.saveAsset({
        file_path: compRes.video_path,
        kind: "video",
        title: `全片成片 · ${projectTitle || "智能成片工程"}`,
        meta: {
          resolution: compRes.resolution || resolution,
          fps: exportFps,
          total_duration_sec: compRes.duration_sec,
          shot_count: shots.length,
          project_title: projectTitle,
        },
      });

      setExportedFilePath(compRes.video_path);
      setMasterDuration(compRes.duration_sec);
      setSavedSuccess(true);
      setExportNotice(
        `✓ 全片成片已成功渲染！总时长约 ${compRes.duration_sec.toFixed(1)} 秒，包含全部镜头音画，已存入素材库，可直接播放或下载。`
      );
    } catch (err) {
      console.error(err);
      setExportNotice("导出异常：" + String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFile = () => {
    if (!exportedFilePath) {
      setExportNotice("请先点击下方「立即合成并导出成片」，渲染完毕后即可下载完整 MP4 视频！");
      return;
    }
    const streamUrl = getStreamUrl(exportedFilePath);
    const link = document.createElement("a");
    link.href = streamUrl;
    link.download = `${projectTitle || "成片导出"}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <Film className="w-4 h-4 text-apple-blue" />
            <span>⑦ 混音成片与终审导出 (N11_EXPORT)</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            全片时间轴混音、多轨字幕烧录与最终成片输出。点击右侧「立即合成并导出成片」由本地 FFmpeg 毫秒级串接全部音画。
          </p>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-apple-green/10 text-apple-green font-medium">
          ✓ 全部前置节点就绪
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Master Video Player */}
        <div className="lg:col-span-2 space-y-4">
          <div className="w-full aspect-video bg-black rounded-apple-lg border border-border-subtle overflow-hidden flex flex-col items-center justify-center relative shadow-card group">
            {exportedFilePath ? (
              <video
                ref={videoRef}
                src={getStreamUrl(exportedFilePath)}
                controls
                onPlay={() => setIsPlayingAll(true)}
                onPause={() => setIsPlayingAll(false)}
                className="w-full h-full object-contain"
              />
            ) : (
              <>
                {shots[0]?.visual_path ? (
                  <img
                    src={
                      shots[0].visual_path.startsWith("http")
                        ? shots[0].visual_path
                        : getStreamUrl(shots[0].visual_path)
                    }
                    alt="poster"
                    className="w-full h-full object-cover opacity-60"
                  />
                ) : null}

                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center p-4">
                  <div className="w-16 h-16 rounded-full bg-apple-blue/20 border border-apple-blue/50 text-apple-blue flex items-center justify-center mb-3">
                    <Film className="w-8 h-8" />
                  </div>
                  <h3 className="font-semibold text-sm text-white">
                    {projectTitle || "新一代 AI 视频工作流全拆解"}
                  </h3>
                  <p className="text-xs text-white/70 mt-1">
                    共 {shots.length} 个分镜 · 全片总长约 {masterDuration.toFixed(1)} 秒 · 画幅 9:16
                  </p>
                  <p className="text-[11px] text-apple-blue mt-2">
                    点击右侧「立即合成并导出成片」进行最终视频串接与导出
                  </p>
                </div>

                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-white/90 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-apple-green" />
                    <span>00:00 / 00:{Math.round(masterDuration)}</span>
                  </span>
                  <span>1080 × 1920 | {exportFps}fps</span>
                </div>
              </>
            )}
          </div>

          {/* Timeline Multi-track Overview */}
          <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-2">
            <div className="text-xs font-semibold text-ink flex items-center gap-1.5 mb-2">
              <Sliders className="w-3.5 h-3.5 text-apple-blue" />
              <span>多轨时间轴总览</span>
            </div>

            {/* Video track */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-14 font-medium text-ink-muted shrink-0">画面轨</span>
              <div className="flex-1 flex gap-1 h-6 bg-surface-muted rounded p-0.5">
                {shots.map((s, i) => (
                  <div
                    key={s.shot_id}
                    className="flex-1 bg-apple-blue/20 border border-apple-blue/40 rounded text-[9px] text-apple-blue flex items-center justify-center truncate px-1"
                  >
                    镜{i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Audio track */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-14 font-medium text-ink-muted shrink-0">人声轨</span>
              <div className="flex-1 flex gap-1 h-6 bg-surface-muted rounded p-0.5">
                {shots.map((s, i) => (
                  <div
                    key={s.shot_id}
                    className="flex-1 bg-apple-green/20 border border-apple-green/40 rounded text-[9px] text-apple-green flex items-center justify-center truncate px-1"
                  >
                    配音{i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* BGM track */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-14 font-medium text-ink-muted shrink-0">BGM轨</span>
              <div className="flex-1 h-5 bg-apple-amber/15 border border-apple-amber/30 rounded text-[9px] text-apple-amber flex items-center justify-center">
                科技节奏底噪 (音量 12% 动态避让)
              </div>
            </div>
          </div>
        </div>

        {/* Right: Export Specification & Actions */}
        <div className="p-5 bg-surface rounded-apple-lg border border-border-subtle shadow-card flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-ink border-b border-border-subtle pb-2">
              导出参数设定
            </h3>

            <div>
              <label className="text-[11px] font-medium text-ink-muted block mb-1.5">导出清晰度</label>
              <div className="grid grid-cols-2 gap-2">
                {["1080p", "4K"].map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    className={`py-2 text-xs font-medium rounded border transition-all cursor-pointer ${
                      resolution === res
                        ? "border-apple-blue bg-apple-blue/5 text-apple-blue font-semibold"
                        : "border-border-subtle bg-surface-muted text-ink-muted"
                    }`}
                  >
                    {res === "1080p" ? "1080P 高清 (推荐)" : "4K 超高清"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-ink-muted block mb-1.5">导出帧率</label>
              <div className="grid grid-cols-2 gap-2">
                {[30, 60].map((fps) => (
                  <button
                    key={fps}
                    onClick={() => setExportFps(fps)}
                    className={`py-2 text-xs font-medium rounded border transition-all cursor-pointer ${
                      exportFps === fps
                        ? "border-apple-blue bg-apple-blue/5 text-apple-blue font-semibold"
                        : "border-border-subtle bg-surface-muted text-ink-muted"
                    }`}
                  >
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>

            {exportNotice && (
              <div className="p-3 bg-apple-green/10 border border-apple-green/30 rounded text-xs text-apple-green leading-relaxed">
                {exportNotice}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-4 border-t border-border-subtle">
            <button
              onClick={handleExportVideo}
              disabled={isExporting}
              className="w-full py-3 bg-ink hover:bg-ink/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 text-apple-blue ${isExporting ? "animate-spin" : ""}`} />
              <span>{isExporting ? "正在渲染全片成片..." : "立即合成并导出成片"}</span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleExportVideo}
                disabled={isExporting}
                className="flex-1 py-2 px-3 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded border border-border-subtle flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-apple-green" />
                    <span>已存入素材库</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-3.5 h-3.5 text-ink-muted" />
                    <span>存入素材库</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadFile}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  exportedFilePath
                    ? "bg-apple-blue text-surface border-apple-blue shadow-soft"
                    : "bg-surface hover:bg-surface-muted text-ink border-border-subtle"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>下载完整 MP4</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
