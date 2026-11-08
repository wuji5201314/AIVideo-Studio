import React from "react";
import { Sliders, Sparkles, Video, Globe, Palette } from "lucide-react";

export interface ProjectBriefConfig {
  title: string;
  topicPrompt: string;
  stylePreset: string;
  aspectRatio: string;
  targetDurationSec: number;
  voiceName: string;
}

interface BriefStageViewProps {
  config: ProjectBriefConfig;
  onChange: (updated: Partial<ProjectBriefConfig>) => void;
  onNextStage: () => void;
}

export const BriefStageView: React.FC<BriefStageViewProps> = ({ config, onChange, onNextStage }) => {
  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <Sliders className="w-4 h-4 text-apple-blue" />
            <span>① 项目设定 (N01_BRIEF)</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            配置成片全局方向、受众风格与基准画幅，该参数将作为后续所有节点的基础指纹 (Fingerprint)。
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-apple-green/10 text-apple-green font-medium">
          ✓ 基础设定已就绪
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Project Title & Theme */}
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-apple-blue" />
            <span>视频项目标题</span>
          </label>
          <input
            type="text"
            value={config.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full text-xs p-2.5 rounded-md border border-border-subtle focus:border-apple-blue bg-canvas text-ink"
            placeholder="例如：新一代 AI 视频工作流全拆解"
          />

          <label className="text-xs font-semibold text-ink flex items-center gap-1.5 pt-2">
            <Globe className="w-3.5 h-3.5 text-apple-blue" />
            <span>核心创作诉求 / 主题提示词</span>
          </label>
          <textarea
            rows={4}
            value={config.topicPrompt}
            onChange={(e) => onChange({ topicPrompt: e.target.value })}
            className="w-full text-xs p-2.5 rounded-md border border-border-subtle focus:border-apple-blue bg-canvas text-ink resize-none leading-relaxed"
            placeholder="描述您想制作的内容核心，如：痛点对比、工具演示、产品评测等..."
          />
        </div>

        {/* Global Settings */}
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink flex items-center gap-1.5 mb-2">
              <Palette className="w-3.5 h-3.5 text-apple-blue" />
              <span>叙事风格预设</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "vlog", name: "爆款口播带货", desc: "快节奏·强Hook" },
                { key: "tech", name: "科技科普评测", desc: "沉稳理性·细节" },
                { key: "story", name: "故事剧情反转", desc: "多情绪起伏" },
                { key: "minimal", name: "极简设计美学", desc: "Apple质感·空灵" },
              ].map((style) => (
                <button
                  key={style.key}
                  onClick={() => onChange({ stylePreset: style.key })}
                  className={`p-2.5 rounded-md text-left border transition-all cursor-pointer ${
                    config.stylePreset === style.key
                      ? "border-apple-blue bg-apple-blue/5 shadow-soft"
                      : "border-border-subtle bg-surface-muted hover:border-ink-muted/30"
                  }`}
                >
                  <div className="text-xs font-medium text-ink">{style.name}</div>
                  <div className="text-[10px] text-ink-muted">{style.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink block mb-2">输出画幅与预估总长</label>
            <div className="flex gap-2">
              {["9:16", "16:9", "1:1"].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => onChange({ aspectRatio: ratio })}
                  className={`flex-1 py-2 text-xs font-medium rounded-md border transition-all cursor-pointer ${
                    config.aspectRatio === ratio
                      ? "border-apple-blue bg-surface text-apple-blue shadow-soft"
                      : "border-border-subtle bg-surface-muted text-ink-muted"
                  }`}
                >
                  {ratio === "9:16" ? "9:16 竖屏" : ratio === "16:9" ? "16:9 横屏" : "1:1 方形"}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onNextStage}
              className="w-full py-2.5 px-4 bg-ink hover:bg-ink/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-apple-blue" />
              <span>保存设定并前往 ② 选题确认</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
