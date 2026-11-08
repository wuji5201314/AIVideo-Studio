import React from "react";
import {
  Home,
  UserCheck,
  Video,
  Sparkles,
  Scissors,
  Image as ImageIcon,
  Mic,
  PenTool,
  FolderArchive,
  Search,
  Zap,
} from "lucide-react";
import { MODULES_REGISTRY } from "../../config/modulesRegistry";
import type { NavModule } from "../../config/modulesRegistry";

interface AppShellProps {
  currentModuleId: string;
  onSelectModule: (id: string) => void;
  children: React.ReactNode;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Home: <Home className="w-4 h-4" />,
  UserCheck: <UserCheck className="w-4 h-4" />,
  Video: <Video className="w-4 h-4" />,
  Sparkles: <Sparkles className="w-4 h-4" />,
  Scissors: <Scissors className="w-4 h-4" />,
  Image: <ImageIcon className="w-4 h-4" />,
  Mic: <Mic className="w-4 h-4" />,
  PenTool: <PenTool className="w-4 h-4" />,
  FolderArchive: <FolderArchive className="w-4 h-4" />,
};

export const AppShell: React.FC<AppShellProps> = ({
  currentModuleId,
  onSelectModule,
  children,
}) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink font-sans">
      {/* Left Apple Style Sidebar */}
      <aside className="w-64 border-r border-border-subtle bg-surface/80 backdrop-blur-md flex flex-col justify-between shrink-0">
        <div>
          {/* Brand header */}
          <div className="p-4 border-b border-border-subtle flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ink text-surface flex items-center justify-center font-bold text-sm tracking-tight shadow-soft">
              AI
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-tight">AIVideo Studio</h1>
              <p className="text-[11px] text-ink-muted">节点化 · 可反馈全能工作台</p>
            </div>
          </div>

          {/* Module navigation list */}
          <nav className="p-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-140px)]">
            {MODULES_REGISTRY.map((mod: NavModule) => {
              const isActive = mod.id === currentModuleId;
              return (
                <button
                  key={mod.id}
                  onClick={() => onSelectModule(mod.id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    isActive
                      ? "bg-surface shadow-soft text-apple-blue font-medium"
                      : "hover:bg-surface-muted/60 text-ink-muted hover:text-ink"
                  }`}
                >
                  <div className={`mt-0.5 ${isActive ? "text-apple-blue" : "text-ink-muted"}`}>
                    {ICON_MAP[mod.iconName] || <Video className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium leading-none mb-1 text-ink">
                      {mod.title}
                    </div>
                    <div className="text-[10px] text-ink-muted truncate">
                      {mod.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom status badge */}
        <div className="p-3 border-t border-border-subtle bg-surface/50">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-apple-green/10 text-apple-green text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-apple-green animate-pulse" />
            <span>服务已就绪 · 本地工作台</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-12 border-b border-border-subtle bg-surface/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-ink-muted bg-surface-muted px-2.5 py-1 rounded-md border border-border-subtle cursor-pointer hover:border-ink-muted/30">
              <Search className="w-3.5 h-3.5 text-ink-muted" />
              <span>搜索功能或分镜...</span>
              <kbd className="text-[10px] bg-surface px-1 py-0.5 rounded border border-border-subtle ml-2">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Topbar Right Actions & Dynamic Island Task Capsule */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-surface border border-border-subtle rounded-full text-xs shadow-soft">
              <Zap className="w-3.5 h-3.5 text-apple-amber" />
              <span className="text-[11px] text-ink-muted">运行模式:</span>
              <span className="font-medium text-[11px] text-ink">按功能自动</span>
            </div>
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
