import React from "react";
import { Lock, Unlock, Clock, FileText, ArrowRight } from "lucide-react";
import type { ShotItem } from "../../../services/api";

interface ScriptStageViewProps {
  shots: ShotItem[];
  onToggleLock: (shotId: string) => void;
  onNextStage: () => void;
}

export const ScriptStageView: React.FC<ScriptStageViewProps> = ({ shots, onToggleLock, onNextStage }) => {
  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <FileText className="w-4 h-4 text-apple-blue" />
            <span>③ 分镜脚本拆解 (N03_SCRIPT)</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            共 {shots.length} 个独立镜头。点击锁头图标保护满意镜头；在右侧面板提交修改意见可仅对未锁定镜头进行增量重写。
          </p>
        </div>
        <button
          onClick={onNextStage}
          className="py-1.5 px-3 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-soft flex items-center gap-1.5 cursor-pointer"
        >
          <span>进入 ④ 分镜配音</span>
          <ArrowRight className="w-3.5 h-3.5 text-apple-blue" />
        </button>
      </div>

      <div className="space-y-3">
        {shots.map((shot, idx) => (
          <div
            key={shot.shot_id}
            className={`p-4 rounded-apple border transition-all ${
              shot.is_locked
                ? "bg-surface border-apple-blue/50 shadow-soft"
                : "bg-surface border-border-subtle hover:border-ink-muted/30 shadow-card"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-ink text-surface flex items-center justify-center text-[10px] font-bold">
                  {idx + 1}
                </span>
                <span className="text-xs font-semibold text-ink">{shot.headline}</span>
                <span className="text-[11px] text-ink-subtle flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {shot.est_duration}s
                </span>
              </div>

              <button
                onClick={() => onToggleLock(shot.shot_id)}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  shot.is_locked
                    ? "bg-apple-blue text-surface shadow-soft"
                    : "bg-surface-muted text-ink-muted hover:text-ink border border-border-subtle"
                }`}
              >
                {shot.is_locked ? (
                  <>
                    <Lock className="w-3 h-3" />
                    <span>已锁定 (保护)</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3 h-3" />
                    <span>未锁定</span>
                  </>
                )}
              </button>
            </div>

            {/* Narration */}
            <div className="text-xs text-ink bg-canvas p-2.5 rounded-md border border-border-subtle mb-2.5 leading-relaxed font-sans">
              <span className="text-[10px] font-semibold text-ink-muted uppercase mr-2 block mb-0.5">
                🎙️ 配音台词 (Narration)
              </span>
              {shot.narration}
            </div>

            {/* Visual Prompt */}
            <div className="text-[11px] text-ink-muted bg-surface-muted/60 p-2.5 rounded-md border border-border-subtle flex items-start gap-2">
              <span className="font-semibold text-ink text-[10px] shrink-0">🖼️ 画面描述:</span>
              <span className="truncate">{shot.visual_prompt}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
