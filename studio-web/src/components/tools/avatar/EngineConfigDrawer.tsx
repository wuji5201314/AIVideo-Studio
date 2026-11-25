import React, { useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, RefreshCw, Save, Cpu, Server, Cloud, Laptop } from "lucide-react";
import { api, type AvatarEngineSettings, type AvatarEnginesResponse } from "../../../services/api";

interface EngineConfigDrawerProps {
  open: boolean;
  onClose: () => void;
  enginesData: AvatarEnginesResponse | null;
  onUpdated: (next: AvatarEnginesResponse) => void;
}

const BACKEND_ICONS: Record<string, React.ReactNode> = {
  comfyui: <Cpu className="w-4 h-4 text-apple-blue" />,
  wan_worker: <Server className="w-4 h-4 text-indigo-500" />,
  dashscope: <Cloud className="w-4 h-4 text-emerald-500" />,
  local_fallback: <Laptop className="w-4 h-4 text-amber-500" />,
};

export const EngineConfigDrawer: React.FC<EngineConfigDrawerProps> = ({
  open,
  onClose,
  enginesData,
  onUpdated,
}) => {
  const [form, setForm] = useState<Partial<AvatarEngineSettings>>({});
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (enginesData?.settings) {
      setForm(enginesData.settings);
    }
  }, [enginesData]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      const updated = await api.updateAvatarEngines(form);
      onUpdated(updated);
      setMsg("配置已保存并完成实时连通性检测");
    } catch (e) {
      setMsg("保存失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleReprobe = async () => {
    setProbing(true);
    setMsg("");
    try {
      const res = await api.getAvatarEngines();
      onUpdated(res);
      setMsg("已完成所有后端健康检测");
    } catch (e) {
      setMsg("检测失败: " + String(e));
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[2px]">
      <div className="w-full max-w-lg bg-surface h-full shadow-2xl border-l border-border-subtle flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-ink">Wan2.2-Animate 开源引擎配置中心</h2>
            <p className="text-[11px] text-ink-muted mt-0.5">
              低配电脑推荐配置 DashScope API（0 显存）或连接云端/局域网开源 ComfyUI
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-muted text-ink-muted cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Live Backend Health Cards */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">当前可用引擎状态</span>
              <button
                onClick={handleReprobe}
                disabled={probing}
                className="text-[11px] text-apple-blue flex items-center gap-1 cursor-pointer hover:underline"
              >
                <RefreshCw className={`w-3 h-3 ${probing ? "animate-spin" : ""}`} />
                <span>重新检测</span>
              </button>
            </div>
            <div className="space-y-2">
              {(enginesData?.backends || []).map((b) => (
                <div
                  key={b.backend_id}
                  className="p-3 rounded-lg border border-border-subtle bg-canvas flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 shrink-0">{BACKEND_ICONS[b.backend_id]}</div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-ink truncate">{b.label}</div>
                      <div className="text-[11px] text-ink-muted truncate">{b.detail}</div>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      b.available
                        ? "bg-apple-green/10 text-apple-green"
                        : "bg-surface-muted text-ink-subtle"
                    }`}
                  >
                    {b.available ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> 就绪
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" /> 离线
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Mode */}
          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <label className="text-xs font-semibold text-ink block">推理后端路由策略</label>
            <select
              value={form.active_backend || "auto"}
              onChange={(e) => setForm({ ...form, active_backend: e.target.value })}
              className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-canvas text-ink"
            >
              <option value="auto">智能路由（优先 ComfyUI → Wan Worker → DashScope → 本机低配）</option>
              <option value="comfyui">强制使用开源 ComfyUI (Wan2.2-Animate-14B)</option>
              <option value="wan_worker">强制使用官方开源 GPU Worker (8390)</option>
              <option value="dashscope">强制使用 DashScope wan2.2-animate API (0 显存)</option>
              <option value="local_fallback">仅使用本机低配开源引擎 (免显存离线)</option>
            </select>
          </div>

          {/* Endpoints */}
          <div className="space-y-3 pt-2 border-t border-border-subtle">
            <div>
              <label className="text-xs font-medium text-ink block mb-1">
                开源 ComfyUI 服务地址（支持局域网 / AutoDL 穿透地址）
              </label>
              <input
                type="text"
                value={form.comfyui_url || ""}
                onChange={(e) => setForm({ ...form, comfyui_url: e.target.value })}
                placeholder="http://127.0.0.1:8188"
                className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-canvas text-ink"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">
                官方开源 Wan2.2 GPU Worker 地址（workers/wan_animate_worker.py）
              </label>
              <input
                type="text"
                value={form.wan_worker_url || ""}
                onChange={(e) => setForm({ ...form, wan_worker_url: e.target.value })}
                placeholder="http://127.0.0.1:8390"
                className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-canvas text-ink"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink block mb-1">
                阿里云百炼 DashScope API Key（可选，低配电脑 0 显存直连 Wan2.2-Animate）
              </label>
              <input
                type="password"
                value={form.dashscope_api_key || ""}
                onChange={(e) => setForm({ ...form, dashscope_api_key: e.target.value })}
                placeholder="sk-..."
                className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-canvas text-ink"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-xs font-medium text-ink">默认开启 Relighting LoRA（环境光影融合）</div>
                <div className="text-[11px] text-ink-muted">Replace 人物替换模式下自动匹配原片光线与色调</div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(form.use_relighting_lora ?? true)}
                onChange={(e) => setForm({ ...form, use_relighting_lora: e.target.checked })}
                className="w-4 h-4 accent-apple-blue cursor-pointer"
              />
            </div>
          </div>

          {msg && (
            <div className="p-2.5 rounded-lg bg-apple-blue/10 text-apple-blue text-xs font-medium">
              {msg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border-subtle text-xs font-medium text-ink-muted hover:text-ink cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-ink text-surface text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "保存并检测中..." : "保存配置"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
