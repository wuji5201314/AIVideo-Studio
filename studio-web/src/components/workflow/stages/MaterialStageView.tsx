import React, { useState } from "react";
import { Image as ImageIcon, Camera, RefreshCw, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import type { ShotItem } from "../../../services/api";

interface MaterialStageViewProps {
  shots: ShotItem[];
  onUpdateShotVisual: (shotId: string, visualPath: string) => void;
  onBatchUpdateVisuals: (updates: Record<string, string>) => void;
  onConfirmMaterials: () => void;
}

// Preset visual themes for aesthetic previews
const MOCK_VISUAL_PREVIEWS: Record<string, string> = {
  shot_01: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80",
  shot_02: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
  shot_03: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
};

export const MaterialStageView: React.FC<MaterialStageViewProps> = ({
  shots,
  onUpdateShotVisual,
  onBatchUpdateVisuals,
  onConfirmMaterials,
}) => {
  const [motionMap, setMotionMap] = useState<Record<string, string>>({
    shot_01: "zoom_in",
    shot_02: "pan_left",
    shot_03: "zoom_out",
  });
  const [generatingShotId, setGeneratingShotId] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState<boolean>(false);

  const handleSetMotion = (shotId: string, motion: string) => {
    setMotionMap((prev) => ({ ...prev, [shotId]: motion }));
  };

  const handleRegenerateVisual = (shot: ShotItem) => {
    setGeneratingShotId(shot.shot_id);
    setTimeout(() => {
      const url =
        MOCK_VISUAL_PREVIEWS[shot.shot_id] ||
        `https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80`;
      onUpdateShotVisual(shot.shot_id, url);
      setGeneratingShotId(null);
    }, 500);
  };

  const handleBatchGenerateAll = () => {
    setBatchGenerating(true);
    setTimeout(() => {
      const updates: Record<string, string> = {};
      shots.forEach((s) => {
        updates[s.shot_id] =
          MOCK_VISUAL_PREVIEWS[s.shot_id] ||
          `https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80`;
      });
      onBatchUpdateVisuals(updates);
      setBatchGenerating(false);
    }, 600);
  };

  const allMaterialsReady = shots.every((s) => Boolean(s.visual_path));

  return (
    <div className="space-y-5">
      <div className="pb-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-apple-amber" />
            <span>⑤ 分镜画面素材与运镜设计 (N06_MATERIAL)</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            为每个镜头匹配电影级画面与推拉摇移（Ken Burns）动态运镜。视觉资产完全与音频解耦，换图无需重跑配音。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBatchGenerateAll}
            disabled={batchGenerating}
            className="py-1.5 px-3 bg-apple-amber/10 hover:bg-apple-amber/20 text-apple-amber text-xs font-semibold rounded-md border border-apple-amber/30 shadow-soft flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${batchGenerating ? "animate-spin" : ""}`} />
            <span>{batchGenerating ? "采买生成中..." : "⚡ 一键采买/生成全部画面"}</span>
          </button>

          <button
            onClick={onConfirmMaterials}
            className="py-1.5 px-3 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-soft flex items-center gap-1.5 cursor-pointer"
          >
            <span>进入 ⑥ 单镜合成</span>
            <ArrowRight className="w-3.5 h-3.5 text-apple-blue" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {shots.map((shot, idx) => {
          const currentMotion = motionMap[shot.shot_id] || "zoom_in";
          const hasVisual = Boolean(shot.visual_path);
          return (
            <div
              key={shot.shot_id}
              className={`p-4 bg-surface rounded-apple border transition-all ${
                hasVisual
                  ? "border-apple-green/50 shadow-soft"
                  : "border-border-subtle shadow-card"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-ink text-surface flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-ink truncate max-w-[120px]">
                      {shot.headline}
                    </span>
                  </div>
                  {hasVisual ? (
                    <span className="text-[10px] text-apple-green font-medium flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> 画面已采买
                    </span>
                  ) : (
                    <span className="text-[10px] text-apple-amber font-medium">待采买/生成</span>
                  )}
                </div>

                {/* Visual Thumbnail or Placeholder Stage */}
                <div className="w-full aspect-video rounded bg-surface-muted border border-border-subtle flex flex-col items-center justify-center overflow-hidden relative mb-2">
                  {shot.visual_path ? (
                    <img
                      src={shot.visual_path}
                      alt={shot.headline}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2 text-ink-subtle">
                      <Camera className="w-6 h-6 mx-auto mb-1 opacity-40" />
                      <span className="text-[10px]">点击下方按钮生成画面</span>
                    </div>
                  )}
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-mono">
                    {currentMotion}
                  </span>
                </div>

                {/* Prompt */}
                <div className="text-[11px] text-ink-muted bg-canvas p-2 rounded border border-border-subtle line-clamp-2">
                  {shot.visual_prompt}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border-subtle/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-ink-muted">运镜动效:</span>
                  <select
                    value={currentMotion}
                    onChange={(e) => handleSetMotion(shot.shot_id, e.target.value)}
                    className="text-[11px] p-1 rounded border border-border-subtle bg-surface text-ink"
                  >
                    <option value="zoom_in">缓慢推近 (Zoom In)</option>
                    <option value="zoom_out">缓慢拉远 (Zoom Out)</option>
                    <option value="pan_left">向左平移 (Pan Left)</option>
                    <option value="pan_right">向右平移 (Pan Right)</option>
                    <option value="static">静态画面 (Static)</option>
                  </select>
                </div>

                <button
                  onClick={() => handleRegenerateVisual(shot)}
                  disabled={generatingShotId === shot.shot_id}
                  className="w-full py-1.5 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded border border-border-subtle flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 text-ink-muted ${generatingShotId === shot.shot_id ? "animate-spin" : ""}`}
                  />
                  <span>
                    {generatingShotId === shot.shot_id ? "采买生成中..." : "重新搜寻/生成此画面"}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 flex items-center justify-between border-t border-border-subtle">
        <div className="text-xs text-ink-muted">
          画面就绪状态：
          <strong className={allMaterialsReady ? "text-apple-green ml-1" : "text-apple-amber ml-1"}>
            {shots.filter((s) => s.visual_path).length} / {shots.length} 镜已就绪
          </strong>
        </div>

        <button
          onClick={onConfirmMaterials}
          className="py-2.5 px-5 bg-ink hover:bg-ink/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center gap-2 cursor-pointer transition-all"
        >
          <span>确认全部画面并进入 ⑥ 单镜独立合成</span>
          <ArrowRight className="w-3.5 h-3.5 text-apple-blue" />
        </button>
      </div>
    </div>
  );
};
