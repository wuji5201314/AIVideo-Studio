import React, { useEffect, useState } from "react";
import { Lightbulb, CheckCircle2, RefreshCw, ArrowRight, Zap, Target } from "lucide-react";

export interface TopicCandidate {
  id: string;
  title: string;
  hookRate: string;
  hookLine: string;
  tags: string[];
}

interface TopicStageViewProps {
  prompt?: string;
  onSelectTopic: (topic: TopicCandidate) => void;
  onConfirmTopic: (topic: TopicCandidate) => void;
}

function buildTopicsFromPrompt(promptText: string): TopicCandidate[] {
  const p = promptText.trim() || "新一代 AI 视频工作流";
  return [
    {
      id: "topic_1",
      title: `关于「${p}」的终极真相：为什么普通人总做不出爆款？`,
      hookRate: "94% 完播预测",
      hookLine: `你是否也在尝试搞定「${p}」？90%的人一上来就踩坑，改一句话就要全部推翻。`,
      tags: ["行业痛点", "核心对比", "深度解说"],
    },
    {
      id: "topic_2",
      title: `3步拆解「${p}」：零门槛上手全流程指南`,
      hookRate: "89% 完播预测",
      hookLine: `不需要复杂的剪辑与代码，用节点化思维玩转「${p}」，极速落地成片。`,
      tags: ["干货实操", "零成本", "效率黑科技"],
    },
    {
      id: "topic_3",
      title: `普通电脑也能跑！用节点化思维搞定「${p}」，告别黑盒盲盒`,
      hookRate: "86% 完播预测",
      hookLine: `不花一分钱冤枉钱，按镜调控打造专属工业级流水线，带你看清「${p}」全部真相！`,
      tags: ["极客实测", "效率翻倍", "爆款指南"],
    },
  ];
}

export const TopicStageView: React.FC<TopicStageViewProps> = ({
  prompt = "",
  onSelectTopic,
  onConfirmTopic,
}) => {
  const [candidates, setCandidates] = useState<TopicCandidate[]>(() => buildTopicsFromPrompt(prompt));
  const [selectedId, setSelectedId] = useState<string>("topic_1");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);

  useEffect(() => {
    if (prompt) {
      const newTopics = buildTopicsFromPrompt(prompt);
      setCandidates(newTopics);
      setSelectedId(newTopics[0].id);
      onSelectTopic(newTopics[0]);
    }
  }, [prompt]);

  const handleRefreshTopics = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const p = prompt.trim() || customTopic.trim() || "创意爆款视频";
      setCandidates([
        {
          id: `topic_${Date.now()}_1`,
          title: `彻底颠覆认知！「${p}」的这套最新打法，正在偷偷改变行业`,
          hookRate: "95% 完播预测",
          hookLine: `很多人还在用老一套折腾「${p}」，殊不知真正的顶级玩家早就换了新逻辑！`,
          tags: ["深度解说", "降本增效", "爆款思维"],
        },
        ...candidates.slice(1),
      ]);
      setIsRefreshing(false);
    }, 500);
  };

  const handlePick = (topic: TopicCandidate) => {
    setSelectedId(topic.id);
    onSelectTopic(topic);
  };

  const handleCustomTopicChange = (val: string) => {
    setCustomTopic(val);
    if (val.trim()) {
      const customCandidate: TopicCandidate = {
        id: "custom_topic",
        title: val.trim(),
        hookRate: "自定义",
        hookLine: val.trim(),
        tags: ["自定义选题"],
      };
      setSelectedId("custom_topic");
      onSelectTopic(customCandidate);
    }
  };

  const handleConfirm = async () => {
    let selected = candidates.find((c) => c.id === selectedId);
    if (selectedId === "custom_topic" && customTopic.trim()) {
      selected = {
        id: "custom_topic",
        title: customTopic.trim(),
        hookRate: "自定义",
        hookLine: customTopic.trim(),
        tags: ["自定义选题"],
      };
    }
    if (!selected) {
      selected = candidates[0];
    }
    setIsGeneratingScript(true);
    try {
      await onConfirmTopic(selected);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-apple-amber" />
            <span>② 选题确认 (N02_TOPIC)</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            围绕您的项目设定「<strong>{prompt || "新一代 AI 视频工作流"}</strong>」生成的爆款选题，挑选后将自动生成匹配的多镜分镜脚本。
          </p>
        </div>
        <button
          onClick={handleRefreshTopics}
          disabled={isRefreshing}
          className="px-3 py-1.5 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-soft flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-ink-muted ${isRefreshing ? "animate-spin" : ""}`} />
          <span>重新发散选题</span>
        </button>
      </div>

      {/* Optional Custom Topic Input */}
      <div className="p-3 bg-surface rounded-apple border border-border-subtle shadow-card flex items-center gap-3">
        <label className="text-xs font-semibold text-ink shrink-0">或直接输入专属选题：</label>
        <input
          type="text"
          value={customTopic}
          onChange={(e) => handleCustomTopicChange(e.target.value)}
          placeholder="输入您专属的定制选题，如：3分钟学会用Python做自动化办公..."
          className="flex-1 text-xs p-2 rounded-md border border-border-subtle bg-canvas text-ink focus:border-apple-blue focus:outline-none"
        />
        {selectedId === "custom_topic" && (
          <span className="text-xs text-apple-blue font-semibold flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> 已选用自定义
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {candidates.map((topic) => {
          const isSelected = selectedId === topic.id;
          return (
            <div
              key={topic.id}
              onClick={() => handlePick(topic)}
              className={`p-4 rounded-apple border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "border-apple-blue bg-surface shadow-soft ring-1 ring-apple-blue"
                  : "border-border-subtle bg-surface hover:border-ink-muted/30 shadow-card"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-apple-green/10 text-apple-green flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span>{topic.hookRate}</span>
                  </span>
                  {isSelected && (
                    <span className="text-xs text-apple-blue font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 已选定
                    </span>
                  )}
                </div>

                <h3 className="text-xs font-bold text-ink leading-snug mb-2">{topic.title}</h3>

                <div className="p-2.5 bg-canvas rounded border border-border-subtle text-[11px] text-ink-muted leading-relaxed mb-3">
                  <div className="font-semibold text-[10px] text-ink uppercase mb-0.5 flex items-center gap-1">
                    <Target className="w-3 h-3 text-apple-amber" />
                    <span>黄金前3秒 Hook:</span>
                  </div>
                  {topic.hookLine}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border-subtle/60">
                  {topic.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted text-ink-subtle">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={handleConfirm}
          disabled={isGeneratingScript}
          className="py-2.5 px-5 bg-ink hover:bg-ink/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
        >
          <span>
            {isGeneratingScript
              ? "正在根据选题生成对应分镜脚本..."
              : "锁定此选题并生成 ③ 匹配分镜脚本"}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-apple-blue" />
        </button>
      </div>
    </div>
  );
};
