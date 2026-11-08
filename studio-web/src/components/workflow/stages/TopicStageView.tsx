import React, { useState } from "react";
import { Lightbulb, CheckCircle2, RefreshCw, ArrowRight, Zap, Target } from "lucide-react";

export interface TopicCandidate {
  id: string;
  title: string;
  hookRate: string;
  hookLine: string;
  tags: string[];
}

const DEFAULT_TOPICS: TopicCandidate[] = [
  {
    id: "topic_1",
    title: "别再用传统黑盒工具了！新一代节点化工作流带你极速出片",
    hookRate: "92% 完播预测",
    hookLine: "为什么别人剪出的视频爆款频出，而你的视频改一句话就要全部推翻？",
    tags: ["行业痛点", "工具对比", "效率黑科技"],
  },
  {
    id: "topic_2",
    title: "100% 免费本地算力：普通电脑也能跑的 AI 视频生产线",
    hookRate: "88% 完播预测",
    hookLine: "不花一分钱API调用费，零成本打造你的24小时爆款全能剪辑师！",
    tags: ["零成本", "极客实操", "干货教程"],
  },
  {
    id: "topic_3",
    title: "从文案到成片只需 3 步：小白也能搞定的按镜微调指南",
    hookRate: "85% 完播预测",
    hookLine: "不需要复杂剪辑技术，按镜锁定关键画面，改到满意为止。",
    tags: ["新手友好", "极速出片", "实操指南"],
  },
];

interface TopicStageViewProps {
  onSelectTopic: (topic: TopicCandidate) => void;
  onNextStage: () => void;
}

export const TopicStageView: React.FC<TopicStageViewProps> = ({ onSelectTopic, onNextStage }) => {
  const [candidates, setCandidates] = useState<TopicCandidate[]>(DEFAULT_TOPICS);
  const [selectedId, setSelectedId] = useState<string>("topic_1");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleRefreshTopics = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setCandidates([
        {
          id: `topic_${Date.now()}_1`,
          title: "AI 剪辑大洗牌！为什么「节点化可反馈」才是自媒体人的终极解法？",
          hookRate: "94% 完播预测",
          hookLine: "传统工具做完就像开盲盒，今天带你看透真正可控的视频工业化流水线！",
          tags: ["深度解说", "降本增效", "爆款思维"],
        },
        ...DEFAULT_TOPICS.slice(1),
      ]);
      setIsRefreshing(false);
    }, 600);
  };

  const handlePick = (topic: TopicCandidate) => {
    setSelectedId(topic.id);
    onSelectTopic(topic);
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
            根据项目设定发散生成的爆款选题。挑选最符合预期的选题，系统将以此自动生成多镜头脚本。
          </p>
        </div>
        <button
          onClick={handleRefreshTopics}
          disabled={isRefreshing}
          className="px-3 py-1.5 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-soft flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-ink-muted ${isRefreshing ? "animate-spin" : ""}`} />
          <span>重新生成选题</span>
        </button>
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
                  ? "bg-surface border-apple-blue shadow-soft ring-1 ring-apple-blue"
                  : "bg-surface border-border-subtle hover:border-ink-muted/30 shadow-card"
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
          onClick={onNextStage}
          className="py-2.5 px-5 bg-ink hover:bg-ink/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center gap-2 cursor-pointer transition-all"
        >
          <span>锁定此选题并生成 ③ 分镜脚本</span>
          <ArrowRight className="w-3.5 h-3.5 text-apple-blue" />
        </button>
      </div>
    </div>
  );
};
