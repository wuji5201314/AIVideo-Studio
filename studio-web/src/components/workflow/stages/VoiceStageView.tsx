import React, { useState } from "react";
import { Mic, Music, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { api, getStreamUrl } from "../../../services/api";
import type { ShotItem } from "../../../services/api";

interface VoiceStageViewProps {
  shots: ShotItem[];
  defaultVoice: string;
  onUpdateShotAudio: (shotId: string, audioPath: string, durationSec: number) => void;
  onNextStage: () => void;
}

export const VoiceStageView: React.FC<VoiceStageViewProps> = ({
  shots,
  defaultVoice,
  onUpdateShotAudio,
  onNextStage,
}) => {
  const [activeVoice, setActiveVoice] = useState<string>(defaultVoice || "zh-CN-YunxiNeural");
  const [bgmTrack, setBgmTrack] = useState<string>("tech_ambient");
  const [bgmVolume, setBgmVolume] = useState<number>(12);
  const [synthesizingShotId, setSynthesizingShotId] = useState<string | null>(null);
  const [batchSynthesizing, setBatchSynthesizing] = useState<boolean>(false);

  const handleSynthesizeSingle = async (shot: ShotItem) => {
    setSynthesizingShotId(shot.shot_id);
    try {
      const res = await api.executeOperator<{ audio_path: string; duration_sec: number }>(
        "op_voice_tts",
        {
          text: shot.narration,
          voice_name: activeVoice,
          rate: "+0%",
          volume: "+0%",
        }
      );
      if (res && res.audio_path) {
        onUpdateShotAudio(shot.shot_id, res.audio_path, res.duration_sec);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSynthesizingShotId(null);
    }
  };

  const handleSynthesizeAllPending = async () => {
    setBatchSynthesizing(true);
    try {
      for (const shot of shots) {
        if (!shot.audio_path) {
          const res = await api.executeOperator<{ audio_path: string; duration_sec: number }>(
            "op_voice_tts",
            {
              text: shot.narration,
              voice_name: activeVoice,
              rate: "+0%",
              volume: "+0%",
            }
          );
          if (res && res.audio_path) {
            onUpdateShotAudio(shot.shot_id, res.audio_path, res.duration_sec);
          }
        }
      }
    } finally {
      setBatchSynthesizing(false);
    }
  };

  const totalDuration = shots.reduce((acc, s) => acc + (s.est_duration || 3.5), 0);

  return (
    <div className="space-y-5">
      <div className="pb-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <Mic className="w-4 h-4 text-apple-green" />
            <span>④ 分镜配音与音轨管理 (N05_VOICE)</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            按镜独立调音、语速微调与 BGM 智能混音。修改单个镜头的台词仅需重录该镜头音频，其余镜头 100% 缓存复用。
          </p>
        </div>
        <button
          onClick={handleSynthesizeAllPending}
          disabled={batchSynthesizing}
          className="py-1.5 px-3 bg-apple-green hover:bg-apple-green/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{batchSynthesizing ? "批量合成中..." : "批量合成未就绪音频"}</span>
        </button>
      </div>

      {/* Global Voice & BGM Configuration Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-surface rounded-apple border border-border-subtle shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-apple-green/10 text-apple-green flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[11px] font-semibold text-ink block mb-1">全局合成音色</label>
            <select
              value={activeVoice}
              onChange={(e) => setActiveVoice(e.target.value)}
              className="w-full text-xs p-1.5 rounded border border-border-subtle bg-surface text-ink"
            >
              <option value="zh-CN-YunxiNeural">云希 (阳光男声 · 推荐)</option>
              <option value="zh-CN-XiaoxiaoNeural">晓晓 (温柔女声 · 情感带货)</option>
              <option value="zh-CN-YunjianNeural">云健 (沉稳解说 · 影视科普)</option>
              <option value="zh-HK-HiuMaanNeural">粤语晓曼 (港风口播)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 border-l border-border-subtle/80 pl-3">
          <div className="w-9 h-9 rounded-lg bg-apple-blue/10 text-apple-blue flex items-center justify-center shrink-0">
            <Music className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[11px] font-semibold text-ink mb-1">
              <span>背景音乐 (BGM) & 音量平衡</span>
              <span className="text-apple-blue font-mono">{bgmVolume}%</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={bgmTrack}
                onChange={(e) => setBgmTrack(e.target.value)}
                className="text-xs p-1.5 rounded border border-border-subtle bg-surface text-ink w-32"
              >
                <option value="tech_ambient">科技轻快</option>
                <option value="business_vlog">商业节奏</option>
                <option value="lofi_chill">轻松Lo-Fi</option>
                <option value="none">纯净无BGM</option>
              </select>
              <input
                type="range"
                min="0"
                max="40"
                value={bgmVolume}
                onChange={(e) => setBgmVolume(Number(e.target.value))}
                className="flex-1 accent-apple-blue h-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Per Shot Audio Track List */}
      <div className="space-y-3">
        {shots.map((shot, idx) => (
          <div
            key={shot.shot_id}
            className="p-3.5 bg-surface rounded-apple border border-border-subtle shadow-card flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-ink text-surface flex items-center justify-center text-[10px] font-bold">
                  {idx + 1}
                </span>
                <span className="text-xs font-semibold text-ink">{shot.headline}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-muted text-ink-subtle">
                  约 {shot.est_duration || 3.5} 秒
                </span>
                {shot.audio_path ? (
                  <span className="text-[10px] text-apple-green font-medium flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> 音频已就绪
                  </span>
                ) : (
                  <span className="text-[10px] text-apple-amber font-medium">待合成</span>
                )}
              </div>
              <div className="text-xs text-ink-muted line-clamp-1 pl-7">{shot.narration}</div>
            </div>

            <div className="flex items-center gap-2 pl-7 md:pl-0 shrink-0">
              {shot.audio_path ? (
                <audio src={getStreamUrl(shot.audio_path)} controls className="h-8 w-56" />
              ) : null}

              <button
                onClick={() => handleSynthesizeSingle(shot)}
                disabled={synthesizingShotId === shot.shot_id}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-surface-muted hover:bg-apple-green/10 hover:text-apple-green text-ink border border-border-subtle flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              >
                <Mic className="w-3 h-3" />
                <span>
                  {synthesizingShotId === shot.shot_id
                    ? "合成中..."
                    : shot.audio_path
                    ? "重录此镜"
                    : "生成配音"}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 flex items-center justify-between border-t border-border-subtle">
        <div className="text-xs text-ink-muted">
          音轨预估总时长：<strong className="text-ink">{totalDuration.toFixed(1)} 秒</strong>
        </div>
        <button
          onClick={onNextStage}
          className="py-2 px-4 bg-ink hover:bg-ink/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center gap-2 cursor-pointer transition-all"
        >
          <span>确认配音并进入 ⑤ 分镜画面</span>
          <ArrowRight className="w-3.5 h-3.5 text-apple-blue" />
        </button>
      </div>
    </div>
  );
};
