import React, { useEffect, useState } from "react";
import { Sparkles, Download, FolderArchive, KeyRound, Loader2, Image as ImageIcon } from "lucide-react";
import { api, type CloudApiSettings, getStreamUrl } from "../../services/api";

interface ImageStudioViewProps {
  onOpenApiSettings: () => void;
}

const STYLE_PROMPTS = [
  {
    label: "极简原木家居实拍",
    prompt: "Editorial interior photography of a minimalist solid walnut sofa in a sunlit modern furniture showroom, warm afternoon shadows, architectural digest style, 8k, photorealistic, ultra detailed",
  },
  {
    label: "小红书爆款探店封面",
    prompt: "Aesthetic cozy boutique coffee and lifestyle studio interior, soft natural window light, shallow depth of field, Kodak Portra 400 film look, clean high-end commercial photography",
  },
  {
    label: "高端人像商业大片",
    prompt: "Professional studio portrait of a confident young Asian entrepreneur in smart casual attire, warm rim lighting, clean neutral backdrop, Leica 50mm f1.4 lens, magazine cover quality",
  },
  {
    label: "科技质感产品海报",
    prompt: "Minimalist luxury product photography on dark matte slate stone, subtle volumetric rim light, ultra crisp details, Apple keynote commercial aesthetic, 8k render",
  },
];

export const ImageStudioView: React.FC<ImageStudioViewProps> = ({ onOpenApiSettings }) => {
  const [apiSettings, setApiSettings] = useState<CloudApiSettings | null>(null);
  const [prompt, setPrompt] = useState(STYLE_PROMPTS[0].prompt);
  const [aspectRatio, setAspectRatio] = useState<"3:4" | "9:16" | "16:9" | "1:1">("3:4");
  const [overlayTitle, setOverlayTitle] = useState("");
  const [overlayBadge, setOverlayBadge] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ image_path: string; model_used: string; resolution: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    api.getCloudApiSettings().then(setApiSettings).catch(() => null);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.executeOperator<{
        image_path: string;
        model_used: string;
        resolution: string;
      }>("op_image_gen", {
        prompt: prompt.trim(),
        aspect_ratio: aspectRatio,
        overlay_title: overlayTitle.trim(),
        overlay_badge: overlayBadge.trim(),
      });
      setResult(res);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-ink">AI 商业级生图与封面工坊</h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-apple-blue/10 text-apple-blue font-semibold">
              云端 FLUX / 万相 / OpenAI 兼容
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            直连真实扩散大模型生成摄影级高清图片，彻底告别廉价色块图；可选叠加杂志风底部渐变中文封面标题
          </p>
        </div>

        <button
          onClick={onOpenApiSettings}
          className="px-3.5 py-2 rounded-lg border border-border-subtle bg-surface hover:bg-surface-muted text-xs font-semibold text-ink flex items-center gap-2 cursor-pointer self-start"
        >
          <KeyRound className="w-3.5 h-3.5 text-apple-blue" />
          <span>{apiSettings?.image_ready ? `生图模型：${apiSettings.image_model}` : "未配置生图 API Key · 点击配置"}</span>
        </button>
      </div>

      {!apiSettings?.image_ready && (
        <div className="p-4 rounded-apple bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="text-xs text-amber-800">
            <strong>尚未配置生图模型 API Key：</strong>请先在「API 模型配置」填入您的硅基流动 / OneAPI / 中转站 Key，即可 0 显存生成真实商业摄影质感图片。
          </div>
          <button
            onClick={onOpenApiSettings}
            className="px-4 py-2 rounded-lg bg-ink text-surface text-xs font-semibold shrink-0 cursor-pointer"
          >
            立即配置 API Key
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
            <div className="text-xs font-bold text-ink">1. 快捷商业摄影风格提示词</div>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_PROMPTS.map((sp) => (
                <button
                  key={sp.label}
                  onClick={() => setPrompt(sp.prompt)}
                  className="p-2 rounded-lg border border-border-subtle bg-canvas hover:border-apple-blue text-left text-[11px] font-medium text-ink cursor-pointer"
                >
                  {sp.label}
                </button>
              ))}
            </div>

            <div>
              <label className="text-[11px] text-ink-muted block mb-1">画面描述提示词（支持中英文，英文摄影词效果更佳）</label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-canvas text-ink resize-none"
              />
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {(["3:4", "9:16", "16:9", "1:1"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                    aspectRatio === r
                      ? "border-apple-blue bg-apple-blue/10 text-apple-blue"
                      : "border-border-subtle bg-canvas text-ink-muted"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
            <div className="text-xs font-bold text-ink">2. 可选：杂志风中文封面排版（留空则出纯摄影原图）</div>
            <input
              type="text"
              value={overlayBadge}
              onChange={(e) => setOverlayBadge(e.target.value)}
              placeholder="左上角小标签，例如：实体探店 · 避坑指南（留空不加）"
              className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
            />
            <input
              type="text"
              value={overlayTitle}
              onChange={(e) => setOverlayTitle(e.target.value)}
              placeholder="底部大字标题，例如：00后开家具店如何做到月销翻倍（留空不加）"
              className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
            />

            {errorMsg && <div className="p-2.5 rounded-lg bg-red-500/10 text-red-600 text-xs">{errorMsg}</div>}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-ink text-surface text-xs font-semibold shadow-soft flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-apple-blue" /> : <Sparkles className="w-4 h-4 text-apple-blue" />}
              <span>{loading ? "云端模型正在高清渲染中..." : "立即生成商业级大片"}</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 p-4 bg-surface rounded-apple border border-border-subtle shadow-card flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">高清出图预览</span>
            {result && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    api
                      .saveAsset({ file_path: result.image_path, kind: "image", title: overlayTitle || "AI商业大片" })
                      .then(() => alert("已存入素材库"))
                  }
                  className="px-2.5 py-1 rounded border border-border-subtle bg-canvas text-xs text-ink flex items-center gap-1 cursor-pointer"
                >
                  <FolderArchive className="w-3.5 h-3.5" /> 存入素材库
                </button>
                <a
                  href={getStreamUrl(result.image_path, true)}
                  download="ai-studio-image.png"
                  className="px-3 py-1 rounded bg-apple-blue text-surface text-xs font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> 下载原图
                </a>
              </div>
            )}
          </div>

          {result ? (
            <div className="space-y-2">
              <img
                src={getStreamUrl(result.image_path)}
                alt="AI Generated"
                className="w-full max-h-[520px] rounded-lg object-contain bg-black/90 border border-border-subtle"
              />
              <div className="text-[11px] text-ink-muted flex justify-between">
                <span>模型：{result.model_used}</span>
                <span>分辨率：{result.resolution}</span>
              </div>
            </div>
          ) : (
            <div className="h-[460px] rounded-lg border-2 border-dashed border-border-subtle bg-canvas flex flex-col items-center justify-center text-ink-muted text-xs gap-2">
              <ImageIcon className="w-9 h-9 text-ink-subtle" />
              <span>填入 API Key 后点击生成，此处展示真实扩散模型出图</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
