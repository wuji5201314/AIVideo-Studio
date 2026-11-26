import React, { useRef, useState } from "react";
import {
  LayoutTemplate,
  Upload,
  Sparkles,
  Download,
  FolderArchive,
  CheckCircle2,
  Plus,
  Trash2,
  Loader2,
  Film,
  Image as ImageIcon,
  Search,
  Scissors,
} from "lucide-react";
import { api, getStreamUrl, type JianYingExportResult, type PexelsVideoItem } from "../../services/api";

interface TemplatePreset {
  id: "store_tour" | "knowledge_card" | "product_promo" | "photo_story";
  name: string;
  desc: string;
  defaultBadge: string;
  defaultTitle: string;
  accentClass: string;
}

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "store_tour",
    name: "实体探店实景模板",
    desc: "门店胶囊标 + 实拍视频/图集底板 + 抖音金黄字幕",
    defaultBadge: "实体探店 · 真实分享",
    defaultTitle: "00后家具店日常：好品质自己会说话",
    accentClass: "border-amber-400/50 bg-amber-500/5",
  },
  {
    id: "knowledge_card",
    name: "知识干货三段卡",
    desc: "深空磨砂卡片 + 3条高亮要点 + 沉稳口播配音",
    defaultBadge: "行业干货 · 必看收藏",
    defaultTitle: "新手做实体最容易踩的3个大坑",
    accentClass: "border-sky-400/50 bg-sky-500/5",
  },
  {
    id: "product_promo",
    name: "好物带货爆款模板",
    desc: "高对比促销标题框 + 核心卖点卡 + 热情带货配音",
    defaultBadge: "源头工厂 · 限时直供",
    defaultTitle: "这套原木沙发凭什么卖爆全网？",
    accentClass: "border-orange-400/50 bg-orange-500/5",
  },
  {
    id: "photo_story",
    name: "多图电影运镜模板",
    desc: "上传多张产品/门店照片，自动 Ken Burns 推拉轮播",
    defaultBadge: "实拍图集 · 沉浸体验",
    defaultTitle: "带你30秒云逛我们的线下展厅",
    accentClass: "border-emerald-400/50 bg-emerald-500/5",
  },
];

interface BatchTemplateJob {
  id: string;
  templateId: TemplatePreset["id"];
  title: string;
  badgeText: string;
  script: string;
  bullets: string[];
  mediaPaths: string[];
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  videoPath?: string;
  durationSec?: number;
  note?: string;
}

export const TemplateVideoStudioView: React.FC = () => {
  const [templateId, setTemplateId] = useState<TemplatePreset["id"]>("store_tour");
  const [title, setTitle] = useState(TEMPLATE_PRESETS[0].defaultTitle);
  const [badgeText, setBadgeText] = useState(TEMPLATE_PRESETS[0].defaultBadge);
  const [script, setScript] = useState(
    "做实体家具这么多年，我们一直坚持源头直供，把中间商差价直接省给客户。交易随缘定，情谊长久存，欢迎来展厅实地体验！"
  );
  const [bulletsText, setBulletsText] = useState("真实源头展厅实拍\n无中间商透明报价\n同城上门送装质保");
  const [voiceName, setVoiceName] = useState("zh-CN-XiaoxiaoNeural");
  const [subtitleStyle, setSubtitleStyle] = useState("douyin_yellow");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");

  const [uploadedMedia, setUploadedMedia] = useState<Array<{ path: string; name: string; kind: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Pexels HD Stock Search & JianYing Draft Export
  const [pexelsQuery, setPexelsQuery] = useState("modern furniture");
  const [searchingPexels, setSearchingPexels] = useState(false);
  const [pexelsList, setPexelsList] = useState<PexelsVideoItem[]>([]);
  const [downloadingPexelsId, setDownloadingPexelsId] = useState<string>("");
  const [exportingDraft, setExportingDraft] = useState(false);
  const [draftResult, setDraftResult] = useState<JianYingExportResult | null>(null);

  const [jobs, setJobs] = useState<BatchTemplateJob[]>([]);
  const [runningAll, setRunningAll] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSelectTemplate = (tpl: TemplatePreset) => {
    setTemplateId(tpl.id);
    setTitle(tpl.defaultTitle);
    setBadgeText(tpl.defaultBadge);
  };

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setErrorMsg("");
    try {
      const added: Array<{ path: string; name: string; kind: string }> = [];
      for (const f of Array.from(files)) {
        const kind = f.type.startsWith("video/") ? "video" : "image";
        const up = await api.uploadAvatarMedia(f, kind);
        added.push({ path: up.file_path, name: up.filename, kind });
      }
      setUploadedMedia((prev) => [...prev, ...added]);
    } catch (err) {
      setErrorMsg("素材上传失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const buildCurrentJob = (): BatchTemplateJob => ({
    id: `tpl_${Date.now()}`,
    templateId,
    title: title.trim() || "模板成片",
    badgeText: badgeText.trim() || "精选推荐",
    script: script.trim(),
    bullets: bulletsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3),
    mediaPaths: uploadedMedia.map((m) => m.path),
    status: "PENDING",
  });

  const executeJob = async (job: BatchTemplateJob) => {
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "RUNNING" } : j)));
    try {
      const res = await api.executeOperator<{
        video_path: string;
        duration_sec: number;
        summary_note: string;
      }>("op_template_video", {
        template_id: job.templateId,
        title: job.title,
        badge_text: job.badgeText,
        script: job.script,
        bullet_points: job.bullets,
        media_paths: job.mediaPaths,
        voice_name: voiceName,
        subtitle_style: subtitleStyle,
        aspect_ratio: aspectRatio,
      });
      if (res?.video_path) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, status: "DONE", videoPath: res.video_path, durationSec: res.duration_sec, note: res.summary_note }
              : j
          )
        );
        setPreviewVideo(res.video_path);
      }
    } catch (err) {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "FAILED" } : j)));
      setErrorMsg("渲染失败: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleInstantGenerate = async () => {
    setErrorMsg("");
    const job = buildCurrentJob();
    setJobs((prev) => [job, ...prev]);
    await executeJob(job);
  };

  const handleAddToBatch = () => {
    setJobs((prev) => [...prev, buildCurrentJob()]);
  };

  const handleSearchPexels = async () => {
    if (!pexelsQuery.trim()) return;
    setSearchingPexels(true);
    setErrorMsg("");
    try {
      const items = await api.searchPexelsVideos(pexelsQuery.trim(), aspectRatio === "9:16" ? "portrait" : "landscape");
      setPexelsList(items);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSearchingPexels(false);
    }
  };

  const handleUsePexelsVideo = async (item: PexelsVideoItem) => {
    setDownloadingPexelsId(item.id);
    setErrorMsg("");
    try {
      const dl = await api.downloadPexelsVideo(item.download_url, `Pexels_${item.id}`);
      setUploadedMedia((prev) => [...prev, { path: dl.file_path, name: `Pexels_${item.id}.mp4`, kind: "video" }]);
    } catch (err) {
      setErrorMsg("下载 Pexels 素材失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDownloadingPexelsId("");
    }
  };

  const handleExportTemplateToJianYing = async () => {
    setExportingDraft(true);
    setErrorMsg("");
    try {
      const tts = await api.executeOperator<{ audio_path: string; duration_sec: number }>("op_voice_tts", {
        text: script.trim() || title.trim(),
        voice_name: voiceName,
      });
      const res = await api.exportJianYingDraft({
        project_name: title.trim() || "模板成片草稿",
        aspect_ratio: aspectRatio,
        write_to_jianying_dir: true,
        shots: [
          {
            headline: title.trim(),
            narration: script.trim(),
            visual_path: uploadedMedia[0]?.path,
            audio_path: tts?.audio_path,
            duration_sec: tts?.duration_sec || 6.0,
          },
        ],
      });
      setDraftResult(res);
    } catch (err) {
      setErrorMsg("导出剪映草稿失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExportingDraft(false);
    }
  };

  const handleRunBatch = async () => {
    setRunningAll(true);
    for (const j of jobs) {
      if (j.status !== "DONE") {
        await executeJob(j);
      }
    }
    setRunningAll(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold tracking-tight text-ink">模板化批量视频生成工坊</h1>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-apple-green/10 text-apple-green font-semibold">
            100% 本机开源 · 0 显存直出
          </span>
        </div>
        <p className="text-xs text-ink-muted">
          选择行业视觉模板，上传实拍视频或产品图，填入文案即可本机 FFmpeg + Edge-TTS 极速批量生成带抖音字幕的成品 MP4
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Template Picker & Form (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. Template Grid */}
          <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
            <div className="text-xs font-bold text-ink flex items-center gap-1.5">
              <LayoutTemplate className="w-3.5 h-3.5 text-apple-blue" />
              <span>1. 选择视频视觉模板</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATE_PRESETS.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                    templateId === tpl.id
                      ? `ring-1 ring-apple-blue ${tpl.accentClass}`
                      : "border-border-subtle bg-canvas hover:border-ink-muted/30"
                  }`}
                >
                  <div className="text-xs font-bold text-ink">{tpl.name}</div>
                  <div className="text-[10px] text-ink-muted mt-0.5 line-clamp-2">{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Optional Real Media Upload */}
          <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">2. 上传底图或实拍视频（可选）</span>
              <button
                onClick={() => mediaInputRef.current?.click()}
                disabled={uploading}
                className="text-[11px] font-semibold text-apple-blue hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>{uploading ? "上传中..." : "上传视频 / 多张图片"}</span>
              </button>
              <input
                ref={mediaInputRef}
                type="file"
                multiple
                accept="video/mp4,video/quicktime,image/png,image/jpeg,image/webp"
                onChange={handleUploadMedia}
                className="hidden"
              />
            </div>

            {uploadedMedia.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {uploadedMedia.map((m, idx) => (
                  <div
                    key={m.path}
                    className="px-2.5 py-1 rounded-md bg-canvas border border-border-subtle text-[11px] flex items-center gap-1.5"
                  >
                    {m.kind === "video" ? <Film className="w-3 h-3 text-apple-blue" /> : <ImageIcon className="w-3 h-3 text-apple-green" />}
                    <span className="max-w-[120px] truncate text-ink">{m.name}</span>
                    <button
                      onClick={() => setUploadedMedia((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-ink-subtle hover:text-red-500 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-ink-muted bg-canvas p-2.5 rounded-lg border border-dashed border-border-subtle">
                未上传时将自动使用模板底图；建议上传实拍视频/照片，或在下方一键检索 Pexels 免费 1080P 高清实拍画面。
              </div>
            )}

            {/* Pexels Free HD Stock Search */}
            <div className="pt-2 border-t border-border-subtle space-y-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={pexelsQuery}
                  onChange={(e) => setPexelsQuery(e.target.value)}
                  placeholder="搜 Pexels 免费 1080P 实拍（如 modern furniture, coffee）"
                  className="flex-1 text-[11px] p-1.5 rounded border border-border-subtle bg-canvas text-ink"
                />
                <button
                  onClick={handleSearchPexels}
                  disabled={searchingPexels}
                  className="px-2.5 py-1.5 rounded bg-surface-muted border border-border-subtle text-[11px] font-semibold text-ink flex items-center gap-1 cursor-pointer"
                >
                  <Search className="w-3 h-3 text-apple-blue" />
                  <span>{searchingPexels ? "搜索中..." : "搜免费实拍"}</span>
                </button>
              </div>
              {pexelsList.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5 max-h-[140px] overflow-y-auto">
                  {pexelsList.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleUsePexelsVideo(item)}
                      disabled={downloadingPexelsId === item.id}
                      className="relative rounded overflow-hidden border border-border-subtle hover:border-apple-blue group cursor-pointer h-20 bg-black"
                      title={`点击导入 Pexels 高清视频 (${item.duration}s)`}
                    >
                      <img src={item.thumbnail} alt={item.author} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
                      <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] px-1 rounded">
                        {downloadingPexelsId === item.id ? "导入中" : `${item.duration}s`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. Content & Voice */}
          <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
            <div className="text-xs font-bold text-ink">3. 填写模板文案与配音</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-ink-muted block mb-1">顶部角标</label>
                <input
                  type="text"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-muted block mb-1">画幅</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as "9:16" | "16:9")}
                  className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
                >
                  <option value="9:16">9:16 竖屏短视频</option>
                  <option value="16:9">16:9 横屏视频</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-ink-muted block mb-1">画面主标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
              />
            </div>

            <div>
              <label className="text-[11px] text-ink-muted block mb-1">口播旁白文案（自动配音 + 字幕）</label>
              <textarea
                rows={3}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-canvas text-ink resize-none"
              />
            </div>

            {(templateId === "knowledge_card" || templateId === "product_promo") && (
              <div>
                <label className="text-[11px] text-ink-muted block mb-1">卡片要点（每行1条，最多3条）</label>
                <textarea
                  rows={3}
                  value={bulletsText}
                  onChange={(e) => setBulletsText(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink resize-none"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <select
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
              >
                <option value="zh-CN-XiaoxiaoNeural">晓晓 · 亲和女声</option>
                <option value="zh-CN-YunxiNeural">云希 · 沉稳男声</option>
                <option value="zh-CN-YunjianNeural">云健 · 商业解说</option>
                <option value="zh-HK-HiuMaanNeural">晓曼 · 港风粤语</option>
              </select>
              <select
                value={subtitleStyle}
                onChange={(e) => setSubtitleStyle(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
              >
                <option value="douyin_yellow">抖音金黄描边字幕</option>
                <option value="clean_white">纯净白字阴影字幕</option>
                <option value="none">关闭字幕</option>
              </select>
            </div>

            {errorMsg && (
              <div className="p-2 rounded bg-red-500/10 text-red-600 text-xs">{errorMsg}</div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAddToBatch}
                className="px-3.5 py-2.5 rounded-lg border border-border-subtle bg-surface-muted text-xs font-semibold text-ink flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> 加入批量队列
              </button>
              <button
                onClick={handleInstantGenerate}
                className="flex-1 py-2.5 rounded-lg bg-ink text-surface text-xs font-semibold shadow-soft flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-apple-blue" /> 立即生成 MP4
              </button>
            </div>

            <button
              onClick={handleExportTemplateToJianYing}
              disabled={exportingDraft}
              className="w-full py-2.5 rounded-lg bg-apple-green text-surface text-xs font-semibold shadow-soft flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{exportingDraft ? "正在生成剪映多轨草稿..." : "一键导出剪映草稿（含配音 + 字幕）"}</span>
            </button>

            {draftResult && (
              <div className="p-2.5 rounded-lg bg-apple-green/10 border border-apple-green/30 text-[11px] text-apple-green space-y-1">
                <div className="font-semibold">
                  {draftResult.written_to_jianying
                    ? `✓ 已写入剪映草稿目录（${draftResult.draft_name}），打开剪映即可编辑！`
                    : `✓ 剪映草稿已打包（${draftResult.draft_name} · ${draftResult.track_summary}）`}
                </div>
                <a
                  href={api.getJianYingZipUrl(draftResult.zip_path)}
                  download={`${draftResult.draft_name}.zip`}
                  className="underline font-semibold inline-flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> 下载便携剪映草稿 ZIP
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right: Queue & Live Video Player (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">批量生成任务队列 ({jobs.length})</span>
              {jobs.some((j) => j.status === "PENDING") && (
                <button
                  onClick={handleRunBatch}
                  disabled={runningAll}
                  className="px-3.5 py-1.5 rounded-lg bg-apple-blue text-surface text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {runningAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>一键渲染全部队列</span>
                </button>
              )}
            </div>

            {jobs.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-muted bg-canvas rounded-lg border border-dashed border-border-subtle">
                在左侧配置好模板后，可点击「立即生成」或先加入多条文案再「一键批量渲染」
              </div>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {jobs.map((j) => (
                  <div
                    key={j.id}
                    className="p-2.5 rounded-lg bg-canvas border border-border-subtle flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink truncate">{j.title}</span>
                        {j.status === "DONE" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-apple-green/10 text-apple-green font-medium">
                            完成 {j.durationSec}s
                          </span>
                        )}
                        {j.status === "RUNNING" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-apple-blue/10 text-apple-blue animate-pulse">
                            渲染中...
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-muted truncate">{j.note || j.script}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {j.videoPath ? (
                        <>
                          <button
                            onClick={() => setPreviewVideo(j.videoPath || null)}
                            className="px-2.5 py-1 text-xs rounded border border-border-subtle bg-surface cursor-pointer"
                          >
                            播放
                          </button>
                          <a
                            href={getStreamUrl(j.videoPath, true)}
                            download={`${j.title}.mp4`}
                            className="px-2.5 py-1 text-xs rounded bg-apple-green text-surface flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" /> 下载
                          </a>
                        </>
                      ) : (
                        <button
                          onClick={() => executeJob(j)}
                          disabled={j.status === "RUNNING"}
                          className="px-2.5 py-1 text-xs rounded border border-border-subtle bg-surface cursor-pointer"
                        >
                          渲染
                        </button>
                      )}
                      <button
                        onClick={() => setJobs((prev) => prev.filter((x) => x.id !== j.id))}
                        className="p-1 text-ink-subtle hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Video Player */}
            <div className="pt-2 border-t border-border-subtle space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink flex items-center gap-1">
                  {previewVideo && <CheckCircle2 className="w-3.5 h-3.5 text-apple-green" />}
                  <span>模板成片预览播放器</span>
                </span>
                {previewVideo && (
                  <button
                    onClick={() =>
                      api
                        .saveAsset({ file_path: previewVideo, kind: "video", title: `模板成片 · ${title}` })
                        .then(() => alert("已存入素材库"))
                    }
                    className="text-ink-muted hover:text-ink flex items-center gap-1 cursor-pointer"
                  >
                    <FolderArchive className="w-3.5 h-3.5" /> 存入素材库
                  </button>
                )}
              </div>
              {previewVideo ? (
                <video
                  key={previewVideo}
                  src={getStreamUrl(previewVideo)}
                  controls
                  autoPlay
                  className="w-full max-h-[420px] rounded-lg bg-black object-contain shadow-soft"
                />
              ) : (
                <div className="h-[340px] rounded-lg border-2 border-dashed border-border-subtle bg-canvas flex flex-col items-center justify-center text-ink-muted text-xs">
                  生成的模板成片将在此自动播放
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
