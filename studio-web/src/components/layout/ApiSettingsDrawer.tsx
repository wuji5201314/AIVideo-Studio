import React, { useEffect, useState } from "react";
import { X, Save, CheckCircle2, AlertCircle, Zap, KeyRound, Loader2 } from "lucide-react";
import { api, type CloudApiSettings } from "../../services/api";

interface ApiSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (settings: CloudApiSettings) => void;
}

const PRESETS = [
  {
    name: "硅基流动 SiliconFlow (推荐一站式)",
    global_base_url: "https://api.siliconflow.cn/v1",
    llm_model: "deepseek-ai/DeepSeek-V3",
    image_model: "black-forest-labs/FLUX.1-schnell",
    video_model: "Wan-AI/Wan2.2-T2V-A14B",
  },
  {
    name: "DeepSeek 官方",
    global_base_url: "https://api.deepseek.com/v1",
    llm_model: "deepseek-chat",
    image_model: "black-forest-labs/FLUX.1-schnell",
    video_model: "Wan-AI/Wan2.2-T2V-A14B",
  },
  {
    name: "阿里云百炼兼容模式",
    global_base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    llm_model: "qwen-plus",
    image_model: "wanx2.1-t2i-turbo",
    video_model: "wan2.2-t2v-plus",
  },
  {
    name: "OneAPI / NewAPI 自定义中转",
    global_base_url: "https://your-relay.com/v1",
    llm_model: "gpt-4o-mini",
    image_model: "gpt-image-1",
    video_model: "wan2.2-t2v-plus",
  },
];

export const ApiSettingsDrawer: React.FC<ApiSettingsDrawerProps> = ({ open, onClose, onSaved }) => {
  const [form, setForm] = useState<Partial<CloudApiSettings>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latency_ms: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    api.getCloudApiSettings().then(setForm).catch(() => null);
  }, [open]);

  if (!open) return null;

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setForm((prev) => ({
      ...prev,
      global_base_url: p.global_base_url,
      llm_model: p.llm_model,
      image_model: p.image_model,
      video_model: p.video_model,
    }));
    setStatusMsg(`已套用「${p.name}」模板，请粘贴您的 API Key 后点击保存`);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg("");
    try {
      const saved = await api.updateCloudApiSettings(form);
      setForm(saved);
      onSaved?.(saved);
      setStatusMsg("配置已保存到本地数据库！");
    } catch (e) {
      setStatusMsg("保存失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await api.updateCloudApiSettings(form);
      const res = await api.testCloudApiConnection();
      setTestResult(res);
    } catch (e) {
      setTestResult({ ok: false, message: String(e), latency_ms: 0 });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]">
      <div className="w-full max-w-xl bg-surface h-full shadow-2xl border-l border-border-subtle flex flex-col">
        <div className="p-5 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-apple-blue/10 text-apple-blue flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">全局 AI 模型 API 配置中心</h2>
              <p className="text-[11px] text-ink-muted">
                填入 OpenAI 兼容接口（硅基流动 / DeepSeek / OneAPI / 中转站），0 显存出大片
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-muted text-ink-muted cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick Presets */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-ink">快捷填入常见平台地址与模型</div>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className="p-2 rounded-lg border border-border-subtle bg-canvas hover:border-apple-blue text-left text-[11px] font-medium text-ink cursor-pointer transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Global Shared Base URL & Key */}
          <div className="p-4 rounded-lg bg-canvas border border-border-subtle space-y-3">
            <div className="text-xs font-bold text-ink">1. 统一中转站配置（所有模块默认共用）</div>
            <div>
              <label className="text-[11px] text-ink-muted block mb-1">Base URL（以 /v1 结尾）</label>
              <input
                type="text"
                value={form.global_base_url || ""}
                onChange={(e) => setForm({ ...form, global_base_url: e.target.value })}
                placeholder="https://api.siliconflow.cn/v1"
                className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-surface text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] text-ink-muted block mb-1">API Key（sk-...，仅保存在您本机 SQLite）</label>
              <input
                type="password"
                value={form.global_api_key || ""}
                onChange={(e) => setForm({ ...form, global_api_key: e.target.value })}
                placeholder="sk-..."
                className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-surface text-ink"
              />
            </div>
          </div>

          {/* Per-module models */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-ink">2. 各模块模型名称（如需独立中转站可填覆盖地址）</div>

            <div className="p-3 rounded-lg border border-border-subtle bg-canvas space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-ink">
                <span>文案 / 分镜 / 爆款洗稿 (LLM)</span>
                {form.llm_ready && <span className="text-[10px] text-apple-green">已就绪</span>}
              </div>
              <input
                type="text"
                value={form.llm_model || ""}
                onChange={(e) => setForm({ ...form, llm_model: e.target.value })}
                placeholder="模型名，如 deepseek-ai/DeepSeek-V3 或 gpt-4o-mini"
                className="w-full text-xs p-2 rounded border border-border-subtle bg-surface text-ink"
              />
            </div>

            <div className="p-3 rounded-lg border border-border-subtle bg-canvas space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-ink">
                <span>高质量生图 / 封面底图 (Image Gen)</span>
                {form.image_ready && <span className="text-[10px] text-apple-green">已就绪</span>}
              </div>
              <input
                type="text"
                value={form.image_model || ""}
                onChange={(e) => setForm({ ...form, image_model: e.target.value })}
                placeholder="模型名，如 black-forest-labs/FLUX.1-schnell 或 gpt-image-1"
                className="w-full text-xs p-2 rounded border border-border-subtle bg-surface text-ink"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={form.image_base_url || ""}
                  onChange={(e) => setForm({ ...form, image_base_url: e.target.value })}
                  placeholder="独立生图 Base URL（留空则复用上方）"
                  className="text-[11px] p-1.5 rounded border border-border-subtle bg-surface text-ink"
                />
                <input
                  type="password"
                  value={form.image_api_key || ""}
                  onChange={(e) => setForm({ ...form, image_api_key: e.target.value })}
                  placeholder="独立生图 Key（留空则复用上方）"
                  className="text-[11px] p-1.5 rounded border border-border-subtle bg-surface text-ink"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border-subtle bg-canvas space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-ink">
                <span>电影级视频生成 (T2V / I2V · Wan2.2)</span>
                {form.video_ready && <span className="text-[10px] text-apple-green">已就绪</span>}
              </div>
              <input
                type="text"
                value={form.video_model || ""}
                onChange={(e) => setForm({ ...form, video_model: e.target.value })}
                placeholder="模型名，如 Wan-AI/Wan2.2-T2V-A14B 或 Wan-AI/Wan2.2-I2V-A14B"
                className="w-full text-xs p-2 rounded border border-border-subtle bg-surface text-ink"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={form.video_base_url || ""}
                  onChange={(e) => setForm({ ...form, video_base_url: e.target.value })}
                  placeholder="独立视频 Base URL（留空则复用上方）"
                  className="text-[11px] p-1.5 rounded border border-border-subtle bg-surface text-ink"
                />
                <input
                  type="password"
                  value={form.video_api_key || ""}
                  onChange={(e) => setForm({ ...form, video_api_key: e.target.value })}
                  placeholder="独立视频 Key（留空则复用上方）"
                  className="text-[11px] p-1.5 rounded border border-border-subtle bg-surface text-ink"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border-subtle bg-canvas space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-ink">
                <span>Pexels 免费高清实拍素材库 & 剪映草稿目录</span>
                {form.pexels_ready && <span className="text-[10px] text-apple-green">Pexels 已就绪</span>}
              </div>
              <input
                type="password"
                value={form.pexels_api_key || ""}
                onChange={(e) => setForm({ ...form, pexels_api_key: e.target.value })}
                placeholder="免费 Pexels API Key（pexels.com/api 免费申请，自动配 1080P 实拍画面）"
                className="w-full text-xs p-2 rounded border border-border-subtle bg-surface text-ink"
              />
              <input
                type="text"
                value={form.jianying_drafts_dir || ""}
                onChange={(e) => setForm({ ...form, jianying_drafts_dir: e.target.value })}
                placeholder="剪映草稿目录（留空则自动识别本机剪映 Pro 默认草稿路径）"
                className="w-full text-[11px] p-2 rounded border border-border-subtle bg-surface text-ink"
              />
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                testResult.ok
                  ? "bg-apple-green/10 border-apple-green/30 text-apple-green"
                  : "bg-red-500/10 border-red-500/30 text-red-600"
              }`}
            >
              {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div>
                <div className="font-semibold">{testResult.message}</div>
                {testResult.latency_ms > 0 && <div className="text-[10px] opacity-80">耗时 {testResult.latency_ms} ms</div>}
              </div>
            </div>
          )}

          {statusMsg && <div className="p-2.5 rounded-lg bg-apple-blue/10 text-apple-blue text-xs font-medium">{statusMsg}</div>}
        </div>

        <div className="p-4 border-t border-border-subtle flex items-center justify-between gap-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-3.5 py-2 rounded-lg border border-border-subtle bg-canvas hover:bg-surface-muted text-xs font-semibold text-ink flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-apple-blue" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
            <span>测试连通性</span>
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border-subtle text-xs text-ink-muted cursor-pointer">
              关闭
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-ink text-surface text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "保存中..." : "保存配置"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
