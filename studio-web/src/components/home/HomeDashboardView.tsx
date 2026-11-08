import React from "react";
import {
  Video,
  UserCheck,
  Mic,
  Scissors,
  Sparkles,
  Layers,
  Zap,
  FolderArchive,
  ArrowRight,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import type { WorkbenchSeed } from "../../services/api";

interface HomeDashboardViewProps {
  onNavigate: (moduleId: string, toolId?: string) => void;
  onSendToWorkbench?: (seed: WorkbenchSeed) => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({ onNavigate }) => {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Top Welcome Banner */}
      <div className="p-6 rounded-apple-lg bg-surface border border-border-subtle shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-xl font-bold tracking-tight text-ink">欢迎进入 AIVideo Studio</h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-apple-green/10 text-apple-green border border-apple-green/20">
              🟢 本地纯净运行 · 0云端费用
            </span>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed max-w-2xl">
            新一代节点化短视频生产工作台。支持按镜调控、局部增量反馈（锁定满意镜头零成本复用），打通从灵感、文案、配音到高清成片全流程。
          </p>
        </div>

        <button
          onClick={() => onNavigate("03-video-gen", "workbench_12nodes")}
          className="px-5 py-2.5 bg-ink hover:bg-ink/90 text-surface text-xs font-semibold rounded-md shadow-soft flex items-center gap-2 cursor-pointer transition-all shrink-0"
        >
          <Zap className="w-4 h-4 text-apple-amber" />
          <span>新建节点化工程</span>
          <ArrowRight className="w-3.5 h-3.5 text-apple-blue" />
        </button>
      </div>

      {/* Core Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card">
          <div className="text-[11px] text-ink-muted mb-1 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-apple-blue" />
            <span>节点工作流</span>
          </div>
          <div className="text-lg font-bold text-ink">12 级工业流</div>
          <div className="text-[10px] text-apple-green mt-1">支持细粒度按镜调控</div>
        </div>

        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card">
          <div className="text-[11px] text-ink-muted mb-1 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-apple-amber" />
            <span>增量修改效率</span>
          </div>
          <div className="text-lg font-bold text-ink">提升 10 倍</div>
          <div className="text-[10px] text-apple-green mt-1">锁定分镜 100% 毫秒复用</div>
        </div>

        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card">
          <div className="text-[11px] text-ink-muted mb-1 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-apple-blue" />
            <span>本地音画渲染</span>
          </div>
          <div className="text-lg font-bold text-ink">FFmpeg 9.0</div>
          <div className="text-[10px] text-ink-muted mt-1">硬件加速 · 零云端依赖</div>
        </div>

        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card">
          <div className="text-[11px] text-ink-muted mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-apple-green" />
            <span>素材库资产保护</span>
          </div>
          <div className="text-lg font-bold text-ink">CAS 内容寻址</div>
          <div className="text-[10px] text-apple-green mt-1">SHA256 防重算守护</div>
        </div>
      </div>

      {/* 3 Primary Fast Workflows */}
      <div>
        <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
          核心创作入口 (按需即用)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Flagship Workbench */}
          <div
            onClick={() => onNavigate("03-video-gen", "workbench_12nodes")}
            className="p-5 bg-surface hover:bg-surface border border-border-subtle hover:border-apple-blue/50 rounded-apple-lg shadow-card hover:shadow-soft cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-apple-blue/10 text-apple-blue flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Video className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-ink mb-1 group-hover:text-apple-blue transition-colors">
                智能成片（多节点工作台）
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                旗舰全流程：从选题策划、脚本拆解、分镜配音、运镜合成到成片导出，支持锁镜改稿。
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-semibold text-apple-blue">
              <span>立即进入工作台</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2: Digital Human */}
          <div
            onClick={() => onNavigate("02-avatar", "avatar_fast")}
            className="p-5 bg-surface hover:bg-surface border border-border-subtle hover:border-apple-green/50 rounded-apple-lg shadow-card hover:shadow-soft cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-apple-green/10 text-apple-green flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-ink mb-1 group-hover:text-apple-green transition-colors">
                一键 / 批量数字人口播
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                6大高精数字人主播形象可选，输入台词一键合成真人声画口播视频，免出镜极速创作。
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-semibold text-apple-green">
              <span>进入数字人工坊</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3: Voice Studio */}
          <div
            onClick={() => onNavigate("07-voice-studio", "voice_tts")}
            className="p-5 bg-surface hover:bg-surface border border-border-subtle hover:border-apple-amber/50 rounded-apple-lg shadow-card hover:shadow-soft cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-apple-amber/10 text-apple-amber flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Mic className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-ink mb-1 group-hover:text-apple-amber transition-colors">
                多音色配音工坊
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                支持普通话热门口播、粤语、东北方言及解说音色，微调语速语调，产物一键存入素材库。
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-semibold text-apple-amber">
              <span>进入配音工坊</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Auxiliary Tooling Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate("04-motion-design", "motion_text_card")}
          className="p-4 bg-surface rounded-apple border border-border-subtle hover:border-ink-muted/30 shadow-card cursor-pointer flex items-center gap-3 transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center text-ink">
            <Sparkles className="w-4 h-4 text-apple-blue" />
          </div>
          <div>
            <div className="text-xs font-semibold text-ink">文字 / 标题卡动效</div>
            <div className="text-[10px] text-ink-muted">居中弹跳、撞击大字动效</div>
          </div>
        </div>

        <div
          onClick={() => onNavigate("05-video-edit", "cut_silence")}
          className="p-4 bg-surface rounded-apple border border-border-subtle hover:border-ink-muted/30 shadow-card cursor-pointer flex items-center gap-3 transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center text-ink">
            <Scissors className="w-4 h-4 text-apple-green" />
          </div>
          <div>
            <div className="text-xs font-semibold text-ink">智能切气口 & 高清放大</div>
            <div className="text-[10px] text-ink-muted">去除无声停顿，紧凑口播节奏</div>
          </div>
        </div>

        <div
          onClick={() => onNavigate("09-asset-library")}
          className="p-4 bg-surface rounded-apple border border-border-subtle hover:border-ink-muted/30 shadow-card cursor-pointer flex items-center gap-3 transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center text-ink">
            <FolderArchive className="w-4 h-4 text-apple-amber" />
          </div>
          <div>
            <div className="text-xs font-semibold text-ink">素材资产库</div>
            <div className="text-[10px] text-ink-muted">查看沉淀的音视频片段与工程</div>
          </div>
        </div>
      </div>
    </div>
  );
};
