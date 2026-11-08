import React, { useEffect, useState } from "react";
import { FolderArchive, ArrowRight, RefreshCw, Volume2, Video, FileText, Image as ImageIcon } from "lucide-react";
import { api, getStreamUrl } from "../../services/api";
import type { AssetItem, ShotItem, WorkbenchSeed } from "../../services/api";

interface AssetLibraryViewProps {
  onSendToWorkbench: (seed: WorkbenchSeed) => void;
}

export const AssetLibraryView: React.FC<AssetLibraryViewProps> = ({ onSendToWorkbench }) => {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [filterKind, setFilterKind] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(false);

  const loadAssets = async (kind?: string) => {
    setLoading(true);
    try {
      const list = await api.listAssets(kind && kind !== "all" ? kind : undefined);
      setAssets(list);
    } catch (err) {
      console.error("Failed to load assets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets(filterKind);
  }, [filterKind]);

  const handleSendAsset = (asset: AssetItem) => {
    const meta = asset.meta || {};
    const prompt = String(meta.prompt || asset.title || "来自素材库的资产");
    const voiceName = meta.voice_name ? String(meta.voice_name) : undefined;
    const aspectRatio = meta.aspect_ratio ? String(meta.aspect_ratio) : "9:16";
    const shots = Array.isArray(meta.shots) ? (meta.shots as ShotItem[]) : undefined;

    onSendToWorkbench({
      prompt,
      voiceName,
      aspectRatio,
      mediaPath: asset.file_path,
      mediaType: (asset.kind as "audio" | "video" | "image" | "script") || "audio",
      shots,
      sourceToolName: `素材库 · ${asset.title}`,
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-ink">素材库 (CAS 统一资产池)</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue font-medium">
              共 {assets.length} 项资产
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            集中管理生成的配音、动态卡片、视频片段与结构化脚本（SHA256 内容寻址去重存储），支持在线试听与一键送入成片工作台
          </p>
        </div>

        <button
          onClick={() => loadAssets(filterKind)}
          className="px-3 py-1.5 bg-surface hover:bg-surface-muted text-ink text-xs font-medium rounded-md border border-border-subtle shadow-soft flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-ink-muted ${loading ? "animate-spin" : ""}`} />
          <span>刷新列表</span>
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
        {[
          { key: "all", label: "全部资产" },
          { key: "audio", label: "配音与音色" },
          { key: "video", label: "视频与动效" },
          { key: "image", label: "画面与封面" },
          { key: "script", label: "分镜脚本" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterKind(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              filterKind === tab.key
                ? "bg-ink text-surface shadow-soft"
                : "bg-surface text-ink-muted hover:text-ink border border-border-subtle"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      {assets.length === 0 ? (
        <div className="p-12 bg-surface border border-border-subtle rounded-apple-lg text-center space-y-2">
          <FolderArchive className="w-8 h-8 text-ink-subtle mx-auto opacity-50" />
          <div className="text-sm font-medium text-ink">暂无已存入的素材</div>
          <p className="text-xs text-ink-muted">
            在任意子工具（如多音色配音、文字动画等）生成产物后，点击「存入素材库」即可永久保存在此处。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => {
            const streamUrl = getStreamUrl(asset.sha256);
            return (
              <div
                key={asset.sha256}
                className="p-4 bg-surface border border-border-subtle hover:border-apple-blue/40 rounded-apple-lg shadow-card flex flex-col justify-between gap-3 transition-all"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {asset.kind === "audio" && <Volume2 className="w-4 h-4 text-apple-green shrink-0" />}
                      {asset.kind === "video" && <Video className="w-4 h-4 text-apple-blue shrink-0" />}
                      {asset.kind === "image" && <ImageIcon className="w-4 h-4 text-apple-amber shrink-0" />}
                      {asset.kind === "script" && <FileText className="w-4 h-4 text-apple-blue shrink-0" />}
                      <span className="text-xs font-semibold text-ink truncate" title={asset.title}>
                        {asset.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-muted text-ink-muted shrink-0">
                      {(asset.size_bytes / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  {/* Inline Media Player */}
                  <div className="bg-surface-muted rounded-md p-2.5 border border-border-subtle flex items-center justify-center min-h-[76px]">
                    {asset.kind === "audio" ? (
                      <audio src={streamUrl} controls className="w-full h-8" />
                    ) : asset.kind === "video" ? (
                      <video src={streamUrl} controls className="w-full max-h-36 rounded bg-black object-contain" />
                    ) : asset.kind === "image" ? (
                      <img src={streamUrl} alt={asset.title} className="w-full max-h-36 rounded object-contain" />
                    ) : (
                      <div className="text-[11px] text-ink-muted text-left w-full line-clamp-3">
                        {String(asset.meta?.prompt || "结构化分镜脚本资产")}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-ink-subtle font-mono">
                    <span>SHA256: {asset.sha256.slice(0, 12)}...</span>
                    <span>{new Date(asset.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleSendAsset(asset)}
                  className="w-full py-2 px-3 bg-surface hover:bg-apple-blue/5 hover:border-apple-blue/40 text-ink text-xs font-medium rounded-md border border-border-subtle shadow-soft flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-apple-blue" />
                  <span>送入成片工作台</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
