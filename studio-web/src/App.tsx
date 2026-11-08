import { useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { WorkflowStudioView } from "./components/workflow/WorkflowStudioView";
import { SchemaToolView } from "./components/tools/SchemaToolView";
import { AssetLibraryView } from "./components/tools/AssetLibraryView";
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
    // Asset Library Module directly opens AssetLibraryView
    if (currentModuleId === "09-asset-library") {
      return <AssetLibraryView onSendToWorkbench={handleSendToWorkbench} />;
    }

    // If active tool is selected, render SchemaToolView or WorkflowStudioView
    if (activeTool) {
      if (activeTool.id === "workbench_12nodes") {
        return <WorkflowStudioView initialSeed={workbenchSeed} />;
      }
      return (
        <SchemaToolView
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
            选择下方子功能直接使用，或产出后一键送入成片工作台
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
