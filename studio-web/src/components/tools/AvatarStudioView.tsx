import React, { useEffect, useState } from "react";
import { Activity, Settings2, Users, Layers } from "lucide-react";
import { api, type AvatarEnginesResponse } from "../../services/api";
import { EngineConfigDrawer } from "./avatar/EngineConfigDrawer";
import { CharacterReplaceStudio } from "./avatar/CharacterReplaceStudio";
import { BatchTalkingStudio } from "./avatar/BatchTalkingStudio";

interface AvatarStudioViewProps {
  initialToolId: string;
}

export const AvatarStudioView: React.FC<AvatarStudioViewProps> = ({ initialToolId }) => {
  const [activeTab, setActiveTab] = useState<"replace" | "batch">(
    initialToolId === "avatar_fast" ? "batch" : "replace"
  );
  const [enginesData, setEnginesData] = useState<AvatarEnginesResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    api.getAvatarEngines().then(setEnginesData).catch(() => null);
  }, []);

  const isNeuralOnline =
    enginesData && enginesData.resolved_backend !== "local_fallback";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Live Engine Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-ink">数字人口播工作台</h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue font-semibold">
              Wan2.2-Animate 开源架构
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            基于开源 Wan2.2-Animate 多后端路由：支持链接/视频真实解析、原场景不变人物替换、低配电脑 0 显存运行与高燃节奏字幕
          </p>
        </div>

        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-surface hover:bg-surface-muted border border-border-subtle shadow-card cursor-pointer transition-all self-start md:self-auto"
        >
          <Activity
            className={`w-3.5 h-3.5 ${
              isNeuralOnline ? "text-apple-green animate-pulse" : "text-amber-500"
            }`}
          />
          <div className="text-left">
            <div className="text-xs font-semibold text-ink">
              {enginesData?.resolved_label || "正在检测开源推理后端..."}
            </div>
            <div className="text-[10px] text-ink-muted">
              点击配置 ComfyUI / Wan Worker / DashScope API
            </div>
          </div>
          <Settings2 className="w-4 h-4 text-ink-muted ml-1" />
        </button>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex gap-2.5 border-b border-border-subtle pb-3">
        <button
          onClick={() => setActiveTab("replace")}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "replace"
              ? "bg-ink text-surface shadow-soft"
              : "bg-surface text-ink-muted hover:text-ink border border-border-subtle"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <div className="text-left">
            <div className="font-semibold">视频人物替换 & 动作迁移</div>
            <div className="text-[10px] opacity-80">链接/本地视频解析 · 场景不变换人</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("batch")}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "batch"
              ? "bg-ink text-surface shadow-soft"
              : "bg-surface text-ink-muted hover:text-ink border border-border-subtle"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <div className="text-left">
            <div className="font-semibold">批量矩阵数字人口播</div>
            <div className="text-[10px] opacity-80">AI 主题裂变 · 多主播批量直出</div>
          </div>
        </button>
      </div>

      {/* Active Studio View */}
      {activeTab === "replace" ? (
        <CharacterReplaceStudio
          enginesData={enginesData}
          onOpenSettings={() => setDrawerOpen(true)}
        />
      ) : (
        <BatchTalkingStudio />
      )}

      {/* Slide-over Engine Configuration Drawer */}
      <EngineConfigDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        enginesData={enginesData}
        onUpdated={(next) => setEnginesData(next)}
      />
    </div>
  );
};
