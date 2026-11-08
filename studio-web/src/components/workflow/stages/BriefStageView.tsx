import React, { useState } from "react";
import {
  Sliders,
  Sparkles,
  Video,
  Globe,
  Palette,
  Wand2,
  Shuffle,
  Tag,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

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

const INSPIRATION_TEMPLATES = [
  {
    tag: "行业痛点",
    title: "为什么90%的人做短视频总是卡壳？",
    prompt: "揭露传统视频制作痛点：改一句话就要全部重录，缺乏工业级工作流。重点对比黑盒盲盒与新一代节点化全流程控镜的颠覆性优势。",
  },
  {
    tag: "干货教学",
    title: "3步搞定零成本高质量口播成片",
    prompt: "零基础实操指南：从文案拆解、多音色配音到多镜拼接。用最通俗易懂的语言，教普通人如何在本地电脑不花一分钱极速出片。",
  },
  {
    tag: "数码科普",
    title: "普通电脑跑AI算力：到底卡在哪一步？",
    prompt: "深度解析本地显存与模型加载瓶颈，通过可视化的流程图解与清晰实测数据，解答为什么本地轻量算子才是个人创作者的终极解法。",
  },
  {
    tag: "效率黑科技",
    title: "告别剪映重开：程序员级视频迭代流",
    prompt: "演示版本化与增量重算（Incremental Build）在视频生产中的降维打击效果，锁定满意镜头，仅重跑修改分镜，效率直接提升10倍。",
  },
];

export const BriefStageView: React.FC<BriefStageViewProps> = ({ config, onChange, onNextStage }) => {
  const [promptMode, setPromptMode] = useState<"manual" | "ai">("manual");
  const [aiKeyword, setAiKeyword] = useState<string>("");
  const [aiStyleIntent, setAiStyleIntent] = useState<string>("pain_point");
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiGeneratedPrompt, setAiGeneratedPrompt] = useState<string>("");

  const handleApplyTemplate = (tmpl: { title: string; prompt: string }) => {
    onChange({
      title: config.title || tmpl.title,
      topicPrompt: tmpl.prompt,
    });
  };

  const handleRandomInspiration = () => {
    const randomItem = INSPIRATION_TEMPLATES[Math.floor(Math.random() * INSPIRATION_TEMPLATES.length)];
    onChange({
      title: randomItem.title,
      topicPrompt: randomItem.prompt,
    });
  };

  const handleAiRefinePrompt = () => {
    const base = config.topicPrompt.trim() || config.title.trim() || "AI 视频创作";
    const refined = `围绕「${base}」打造全网高完播爆款：前3秒抛出尖锐反直觉痛点引发强烈共鸣，中间通过结构化3幕展开核心脉络与关键实操，结尾总结高价值金句并引导互动。`;
    onChange({ topicPrompt: refined });
  };

  const handleGenerateAiPrompt = () => {
    if (!aiKeyword.trim()) return;
    setIsAiGenerating(true);
    setTimeout(() => {
      const kw = aiKeyword.trim();
      let formula = "";
      if (aiStyleIntent === "pain_point") {
        formula = `深入剖析「${kw}」中最致命的核心误区，直击传统方案耗时长、成本高的问题；重点对比新一代方法带来的降维打击体验，结尾给出具体可落地的执行清单。`;
      } else if (aiStyleIntent === "tutorial") {
        formula = `手把手保姆级教学「${kw}」：从基础认知、工具准备到最终实操，按照清晰的三大步骤循序渐进拆解，确保零基础新手也能一次听懂并立竿见影出成果。`;
      } else {
        formula = `深度客观评测「${kw}」：通过真实场景对比与关键指标拆解，还原真实表现与底层逻辑，帮助创作者在繁杂信息中一眼识别最优解法。`;
      }
      setAiGeneratedPrompt(formula);
      setIsAiGenerating(false);
    }, 400);
  };

  const handleAdoptAiGenerated = () => {
    if (aiGeneratedPrompt) {
      onChange({
        title: config.title || `关于「${aiKeyword.trim()}」的深度拆解`,
        topicPrompt: aiGeneratedPrompt,
      });
      setPromptMode("manual");
    }
  };

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
        {/* Left Column: Project Title & Prompt Generator */}
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink flex items-center gap-1.5 mb-1.5">
              <Video className="w-3.5 h-3.5 text-apple-blue" />
              <span>视频项目标题</span>
            </label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="w-full text-xs p-2.5 rounded-md border border-border-subtle focus:border-apple-blue bg-canvas text-ink"
              placeholder="例如：3步搞定零成本高质量口播成片"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-apple-blue" />
                <span>核心创作诉求 / 主题提示词</span>
              </label>

              {/* Dual Mode Switch */}
              <div className="flex items-center p-0.5 bg-surface-muted rounded-md border border-border-subtle text-[11px]">
                <button
                  type="button"
                  onClick={() => setPromptMode("manual")}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer font-medium ${
                    promptMode === "manual"
                      ? "bg-surface text-ink shadow-soft"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  ✍️ 自主输入
                </button>
                <button
                  type="button"
                  onClick={() => setPromptMode("ai")}
                  className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 font-medium ${
                    promptMode === "ai"
                      ? "bg-apple-blue text-surface shadow-soft"
                      : "text-apple-blue hover:text-apple-blue/80"
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>AI 帮我生成</span>
                </button>
              </div>
            </div>

            {promptMode === "manual" ? (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  value={config.topicPrompt}
                  onChange={(e) => onChange({ topicPrompt: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-md border border-border-subtle focus:border-apple-blue bg-canvas text-ink resize-none leading-relaxed"
                  placeholder="可在此直接输入您的创作诉求，或点击下方「AI 扩写润色」/「随机灵感」自动填充..."
                />

                {/* Smart Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAiRefinePrompt}
                      className="px-2.5 py-1 bg-apple-blue/10 hover:bg-apple-blue/20 text-apple-blue text-[11px] font-medium rounded border border-apple-blue/20 flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>AI 扩写润色</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRandomInspiration}
                      className="px-2.5 py-1 bg-surface-muted hover:bg-surface text-ink text-[11px] font-medium rounded border border-border-subtle flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Shuffle className="w-3 h-3 text-ink-muted" />
                      <span>随机灵感</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-ink-subtle">
                    {config.topicPrompt.length} 字
                  </span>
                </div>

                {/* Quick Inspiration Pills */}
                <div className="pt-2">
                  <div className="text-[10px] text-ink-muted mb-1.5 flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" />
                    <span>常用爆款配方 (点击直接应用)：</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {INSPIRATION_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.tag}
                        type="button"
                        onClick={() => handleApplyTemplate(tmpl)}
                        className="text-[10px] px-2 py-0.5 rounded bg-surface-muted hover:bg-surface text-ink-muted hover:text-apple-blue border border-border-subtle cursor-pointer transition-all"
                      >
                        #{tmpl.tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* AI Generator Mode */
              <div className="p-3 bg-canvas rounded-md border border-apple-blue/30 space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-ink block mb-1">
                    输入核心关键词或视频话题
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiKeyword}
                      onChange={(e) => setAiKeyword(e.target.value)}
                      placeholder="例如：自学剪辑、AI绘画变现、新手买相机..."
                      className="flex-1 text-xs p-2 rounded border border-border-subtle bg-surface text-ink focus:border-apple-blue focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateAiPrompt}
                      disabled={isAiGenerating || !aiKeyword.trim()}
                      className="px-3 py-1.5 bg-apple-blue hover:bg-apple-blue/90 disabled:opacity-50 text-surface text-xs font-semibold rounded shadow-soft flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isAiGenerating ? "生成中..." : "立即生成"}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-ink-muted block mb-1">
                    选择爆款框架
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: "pain_point", label: "痛点反转+解法" },
                      { key: "tutorial", label: "3步保姆级教学" },
                      { key: "review", label: "客观深度评测" },
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setAiStyleIntent(f.key)}
                        className={`py-1 text-[11px] rounded border transition-all cursor-pointer ${
                          aiStyleIntent === f.key
                            ? "border-apple-blue bg-apple-blue/10 text-apple-blue font-semibold"
                            : "border-border-subtle bg-surface text-ink-muted"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {aiGeneratedPrompt && (
                  <div className="p-2.5 bg-surface rounded border border-border-subtle space-y-2">
                    <div className="text-[10px] text-apple-green font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>已为您生成结构化提示词：</span>
                    </div>
                    <p className="text-xs text-ink leading-relaxed">
                      {aiGeneratedPrompt}
                    </p>
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAdoptAiGenerated}
                        className="py-1 px-3 bg-ink hover:bg-ink/90 text-surface text-xs font-medium rounded flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <span>采用并填入项目</span>
                        <ArrowRight className="w-3 h-3 text-apple-blue" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Global Settings & Navigation */}
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
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
                    type="button"
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
              <label className="text-xs font-semibold text-ink block mb-2">输出画幅与基准比例</label>
              <div className="flex gap-2">
                {["9:16", "16:9", "1:1"].map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
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
          </div>

          <div className="pt-4 border-t border-border-subtle">
            <button
              type="button"
              onClick={onNextStage}
              className="w-full py-3 px-4 bg-ink hover:bg-ink/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center justify-center gap-2 cursor-pointer transition-all"
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
