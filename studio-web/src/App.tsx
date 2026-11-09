import { useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { WorkflowStudioView } from "./components/workflow/WorkflowStudioView";
import { SchemaToolView } from "./components/tools/SchemaToolView";
import { AvatarStudioView } from "./components/tools/AvatarStudioView";
import { AssetLibraryView } from "./components/tools/AssetLibraryView";
import { HomeDashboardView } from "./components/home/HomeDashboardView";
import { MODULES_REGISTRY } from "./config/modulesRegistry";
import type { SubTool } from "./config/modulesRegistry";
import type { WorkbenchSeed } from "./services/api";
import { ArrowRight, Sparkles } from "lucide-react";

export function App() {
  const [currentModuleId, setCurrentModuleId] = useState<string>("03-video-gen");
  const [activeTool, setActiveTool] = useState<SubTool | null>(null);
  const [workbenchSeed, setWorkbenchSeed] = useState<WorkbenchSeed | null>(null);

  const currentModule =
    MODULES_REGISTRY.find((m) => m.id === currentModuleId) || MODULES_REGISTRY[0];

  const handleSelectModule = (id: string) => {
    setCurrentModuleId(id);
    setActiveTool(null);
  };

  const handleSendToWorkbench = (seed: WorkbenchSeed) => {
    setWorkbenchSeed(seed);
    setCurrentModuleId("03-video-gen");
    setActiveTool(null);
  };

  const renderContent = () => {
    // Home Module renders Home Dashboard
    if (currentModuleId === "01-home" && !activeTool) {
      return (
        <HomeDashboardView
          onNavigate={(modId, tId) => {
            setCurrentModuleId(modId);
            if (tId) {
              const targetMod = MODULES_REGISTRY.find((m) => m.id === modId);
              const tool = targetMod?.tools.find((t) => t.id === tId) || null;
              setActiveTool(tool);
            } else {
              setActiveTool(null);
            }
          }}
          onSendToWorkbench={handleSendToWorkbench}
        />
      );
    }

    // Asset Library Module directly opens AssetLibraryView
    if (currentModuleId === "09-asset-library") {
      return <AssetLibraryView onSendToWorkbench={handleSendToWorkbench} />;
    }

    // If active tool is selected, render dedicated Studio View
    if (activeTool) {
      if (activeTool.id === "workbench_12nodes" || activeTool.id === "quick_workbench") {
        return <WorkflowStudioView initialSeed={workbenchSeed} />;
      }
      if (activeTool.id.startsWith("avatar_")) {
        return <AvatarStudioView key={activeTool.id} initialToolId={activeTool.id} />;
      }
      return (
        <SchemaToolView
          key={activeTool.id}
          toolId={activeTool.id}
          toolName={activeTool.name}
          description={activeTool.description}
          operatorId={activeTool.operatorId}
          isFreeLocal={activeTool.isFreeLocal}
          onSendToWorkbench={handleSendToWorkbench}
        />
      );
    }

    // Special case for video-gen default to flagship 12-nodes workbench
    if (currentModuleId === "03-video-gen") {
      return <WorkflowStudioView initialSeed={workbenchSeed} />;
    }

    // Default category tools gallery
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-ink">{currentModule.title}</h1>
            <span className="text-xs text-ink-muted">/ {currentModule.subtitle}</span>
          </div>
          <p className="text-xs text-ink-muted">
            每个子功能均配备独立专属工坊与定制化处理流，直接产出并下载成品文件（MP4 / PNG / MP3）
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentModule.tools.map((tool) => (
            <div
              key={tool.id}
              onClick={() => setActiveTool(tool)}
              className="p-5 bg-surface hover:bg-surface border border-border-subtle hover:border-apple-blue/50 rounded-apple-lg shadow-card hover:shadow-soft cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center text-ink group-hover:text-apple-blue transition-colors">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  {tool.badge && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue">
                      {tool.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-ink mb-1 group-hover:text-apple-blue transition-colors">
                  {tool.name}
                </h3>
                <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">
                  {tool.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border-subtle/60 flex items-center justify-between text-xs font-medium text-ink-muted group-hover:text-apple-blue">
                <span className="text-[11px] text-ink-subtle">
                  {tool.isFreeLocal ? "🟢 本机算力 · 0费用" : "⚡ 模型云端推理"}
                </span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AppShell currentModuleId={currentModuleId} onSelectModule={handleSelectModule}>
      {renderContent()}
    </AppShell>
  );
}

export default App;
