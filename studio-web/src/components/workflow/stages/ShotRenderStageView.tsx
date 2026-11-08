import React, { useRef, useState } from "react";
import { Layers, Play, Pause, CheckCircle2, RefreshCw, ArrowRight, Volume2, Sparkles } from "lucide-react";
import { api, getStreamUrl } from "../../../services/api";
import type { ShotItem } from "../../../services/api";

interface ShotRenderStageViewProps {
  shots: ShotItem[];
  defaultVoice?: string;
  onUpdateShot: (shotId: string, updates: Partial<ShotItem>) => void;
  onNextStage: () => void;
}

export const ShotRenderStageView: React.FC<ShotRenderStageViewProps> = ({
  shots,
  defaultVoice = "zh-CN-YunxiNeural",
  onUpdateShot,
  onNextStage,
}) => {
  const [renderingShotId, setRenderingShotId] = useState<string | null>(null);
  const [renderingAll, setRenderingAll] = useState<boolean>(false);
  const [playingShotId, setPlayingShotId] = useState<string | null>(null);
  const [renderNotice, setRenderNotice] = useState<string>("");

  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const handlePlayToggle = (shotId: string) => {
    const audioEl = audioRefs.current[shotId];
    if (!audioEl) return;

    if (playingShotId === shotId) {
      audioEl.pause();
      setPlayingShotId(null);
    } else {
      // Pause any currently playing audio
      if (playingShotId && audioRefs.current[playingShotId]) {
        audioRefs.current[playingShotId]?.pause();
      }
      audioEl.currentTime = 0;
      audioEl.play().then(() => {
        setPlayingShotId(shotId);
      }).catch((e) => {
        console.error("Playback failed:", e);
      });
    }
  };

  const renderSingleShot = async (shot: ShotItem) => {
    setRenderingShotId(shot.shot_id);
    setRenderNotice(`正在合成第 ${shot.shot_id} 镜...`);
    try {
      let audioPath = shot.audio_path;
      let durationSec = shot.est_duration || 3.5;

      // 1. Synthesize audio if missing
      if (!audioPath) {
        const ttsRes = await api.executeOperator<{ audio_path: string; duration_sec: number }>(
          "op_voice_tts",
          {
            text: shot.narration,
            voice_name: defaultVoice,
            rate: "+0%",
            volume: "+0%",
          }
        );
        if (ttsRes?.audio_path) {
          audioPath = ttsRes.audio_path;
          durationSec = ttsRes.duration_sec || durationSec;
        }
      }

      // 2. Ensure visual path exists
      const visualPath =
        shot.visual_path ||
        `https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80`;

      onUpdateShot(shot.shot_id, {
        audio_path: audioPath,
        visual_path: visualPath,
        est_duration: durationSec,
      });

      setRenderNotice(`✓ 第 ${shot.shot_id} 镜音画已成功独立合成！`);
    } catch (err) {
      console.error("Render shot error:", err);
      setRenderNotice(`第 ${shot.shot_id} 镜合成失败：${String(err)}`);
    } finally {
      setRenderingShotId(null);
    }
  };

  const handleRenderAllPending = async () => {
    setRenderingAll(true);
    setRenderNotice("正在并行增量合成所有未就绪镜头...");
    try {
      for (const shot of shots) {
        if (!shot.audio_path || !shot.visual_path) {
          let audioPath = shot.audio_path;
          let duration = shot.est_duration || 3.5;

          if (!audioPath) {
            const ttsRes = await api.executeOperator<{ audio_path: string; duration_sec: number }>(
              "op_voice_tts",
              {
                text: shot.narration,
                voice_name: defaultVoice,
                rate: "+0%",
                volume: "+0%",
              }
            );
            if (ttsRes?.audio_path) {
              audioPath = ttsRes.audio_path;
              duration = ttsRes.duration_sec || duration;
            }
          }

          const visualPath =
            shot.visual_path ||
            `https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80`;

          onUpdateShot(shot.shot_id, {
            audio_path: audioPath,
            visual_path: visualPath,
            est_duration: duration,
          });
        }
      }
      setRenderNotice("✓ 全部分镜独立片段已合成完毕！可点击各镜头进行试听，或直接推进至成片混音。");
    } catch (err) {
      console.error(err);
      setRenderNotice(`增量合成异常：${String(err)}`);
    } finally {
      setRenderingAll(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="pb-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <Layers className="w-4 h-4 text-apple-blue" />
            <span>⑥ 单镜独立合成渲染 (N07_SHOT_RENDER)</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            各分镜独立对齐音频与画面。点击任一镜头中的绿色播放按钮可单独试听音画片段。
          </p>
        </div>
        <button
          onClick={handleRenderAllPending}
          disabled={renderingAll}
          className="py-1.5 px-3 bg-apple-blue hover:bg-apple-blue/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${renderingAll ? "animate-spin" : ""}`} />
          <span>{renderingAll ? "增量合成中..." : "增量渲染全部未就绪镜头"}</span>
        </button>
      </div>

      {renderNotice && (
        <div className="p-2.5 bg-apple-green/10 border border-apple-green/30 rounded-md text-xs text-apple-green font-medium">
          {renderNotice}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shots.map((shot, idx) => {
          const isDone = Boolean(shot.audio_path);
          const isPlaying = playingShotId === shot.shot_id;
          const isRendering = renderingShotId === shot.shot_id;

          return (
            <div
              key={shot.shot_id}
              className={`p-4 bg-surface rounded-apple border transition-all ${
                isDone
                  ? "border-apple-green/50 shadow-soft"
                  : "border-border-subtle shadow-card"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-ink text-surface flex items-center justify-center text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-ink truncate max-w-[130px]">
                    {shot.headline}
                  </span>
                </div>
                {isDone ? (
                  <span className="text-[10px] text-apple-green font-medium flex items-center gap-0.5 shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> 片段已就绪
                  </span>
                ) : (
                  <span className="text-[10px] text-apple-amber font-medium shrink-0">
                    待合成渲染
                  </span>
                )}
              </div>

              {/* Shot Visual / Playback Preview Card */}
              <div className="w-full aspect-video rounded bg-black flex flex-col items-center justify-center relative overflow-hidden mb-3 group">
                {shot.visual_path ? (
                  <img
                    src={shot.visual_path.startsWith("http") ? shot.visual_path : getStreamUrl(shot.visual_path)}
                    alt={shot.headline}
                    className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-muted flex items-center justify-center text-ink-subtle text-[11px]">
                    画面素材占位
                  </div>
                )}

                {/* Overlay Play / Pause Button */}
                {isDone ? (
                  <button
                    onClick={() => handlePlayToggle(shot.shot_id)}
                    className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-apple-green text-white flex items-center justify-center backdrop-blur-sm shadow-card transition-all cursor-pointer group-hover:scale-105 active:scale-95"
                    title={isPlaying ? "点击暂停" : "点击试听"}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>
                ) : (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white/80 p-2 text-center">
                    <span className="text-xs font-medium">尚未执行合成</span>
                    <span className="text-[10px] text-white/60">点击下方按钮一键渲染</span>
                  </div>
                )}

                {/* Duration & Status Pill */}
                <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] text-white/90 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-apple-green" />
                    <span>{isPlaying ? "正在试听..." : `时长: ${shot.est_duration || 3.5}s`}</span>
                  </span>
                  <span>1080P</span>
                </div>

                {/* Hidden Audio Element for Playback */}
                {shot.audio_path && (
                  <audio
                    ref={(el) => {
                      audioRefs.current[shot.shot_id] = el;
                    }}
                    src={getStreamUrl(shot.audio_path)}
                    onEnded={() => setPlayingShotId(null)}
                    onPause={() => {
                      if (playingShotId === shot.shot_id) setPlayingShotId(null);
                    }}
                  />
                )}
              </div>

              {/* Subtitle preview */}
              <div className="p-2 bg-canvas rounded border border-border-subtle text-[11px] text-ink leading-relaxed mb-3 line-clamp-2">
                <span className="text-[10px] font-semibold text-ink-muted block mb-0.5">字幕轨:</span>
                "{shot.narration}"
              </div>

              <button
                onClick={() => renderSingleShot(shot)}
                disabled={isRendering}
                className="w-full py-1.5 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded border border-border-subtle flex items-center justify-center gap-1 cursor-pointer transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 text-ink-muted ${isRendering ? "animate-spin" : ""}`} />
                <span>
                  {isRendering ? "正在合成中..." : isDone ? "重新合成此镜" : "立即渲染此镜"}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={onNextStage}
          className="py-2.5 px-5 bg-ink hover:bg-ink/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center gap-2 cursor-pointer transition-all"
        >
          <span>单镜无误，进入 ⑦ 混音成片导出</span>
          <ArrowRight className="w-3.5 h-3.5 text-apple-blue" />
        </button>
      </div>
    </div>
  );
};
