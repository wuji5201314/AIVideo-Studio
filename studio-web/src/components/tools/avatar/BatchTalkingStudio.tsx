import React, { useRef, useState } from "react";
import {
  Sparkles,
  Download,
  FolderArchive,
  CheckCircle2,
  Trash2,
  Upload,
  Link2,
  UserCheck,
  Film,
  Loader2,
  AlertTriangle,
  Archive,
  RefreshCw,
} from "lucide-react";
import { api, getStreamUrl } from "../../../services/api";

interface CharacterItem {
  id: string;
  name: string;
  imagePath: string;
  isCustom: boolean;
  voice: string;
}

interface BatchRemakeItem {
  id: string;
  sourceLabel: string;
  sourceType: "link" | "upload";
  rawUrl?: string;
  localVideoPath: string;
  previewImage: string;
  durationSec: number;
  downloadSucceeded: boolean;
  warningNote: string;
  scriptText: string;
  characterId: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  progress: number;
  stageMessage: string;
  outputVideoPath?: string;
  outputDuration?: number;
  engineNote?: string;
  errorMsg?: string;
}

const DEFAULT_CHARACTERS: CharacterItem[] = [
  {
    id: "preset_1",
    name: "活力小琳",
    imagePath: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
    isCustom: false,
    voice: "zh-CN-XiaoxiaoNeural",
  },
  {
    id: "preset_2",
    name: "极客阿辰",
    imagePath: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
    isCustom: false,
    voice: "zh-CN-YunxiNeural",
  },
];

export const BatchTalkingStudio: React.FC = () => {
  const [characters, setCharacters] = useState<CharacterItem[]>(DEFAULT_CHARACTERS);
  const [assignMode, setAssignMode] = useState<"single" | "round_robin">("round_robin");
  const [activeCharId, setActiveCharId] = useState<string>(DEFAULT_CHARACTERS[0].id);
  const [uploadingChars, setUploadingChars] = useState(false);
  const charInputRef = useRef<HTMLInputElement>(null);

  const [bulkLinksText, setBulkLinksText] = useState("");
  const [parsingLinks, setParsingLinks] = useState(false);
  const [uploadingVideos, setUploadingVideos] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [animateMode, setAnimateMode] = useState<"replace" | "move">("replace");
  const [audioMode, setAudioMode] = useState<"keep_original" | "tts_replace">("keep_original");
  const [subtitleStyle, setSubtitleStyle] = useState("douyin_yellow");
  const [resolution, setResolution] = useState<"720p" | "480p">("720p");

  const [queue, setQueue] = useState<BatchRemakeItem[]>([]);
  const [runningBatch, setRunningBatch] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [previewItem, setPreviewItem] = useState<BatchRemakeItem | null>(null);
  const [notice, setNotice] = useState("");

  const customChars = characters.filter((c) => c.isCustom);
  const activePool = customChars.length > 0 ? customChars : characters;

  const pickCharacterForIndex = (idx: number): CharacterItem => {
    if (assignMode === "single") {
      return characters.find((c) => c.id === activeCharId) || activePool[0];
    }
    return activePool[idx % activePool.length];
  };

  const handleUploadCharacters = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingChars(true);
    setNotice("");
    try {
      const added: CharacterItem[] = [];
      for (const f of Array.from(files)) {
        const up = await api.uploadAvatarMedia(f, "image");
        added.push({
          id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: f.name.replace(/\.[^.]+$/, "").slice(0, 12),
          imagePath: up.file_path,
          isCustom: true,
          voice: "zh-CN-XiaoxiaoNeural",
        });
      }
      setCharacters((prev) => [...added, ...prev]);
      setActiveCharId(added[0].id);
      setNotice(`已导入 ${added.length} 张自定义人物照片，批量任务将优先使用您上传的人物`);
    } catch (err) {
      setNotice("上传人物照片失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingChars(false);
      e.target.value = "";
    }
  };

  const handleParseBulkLinks = async () => {
    const lines = bulkLinksText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setParsingLinks(true);
    setNotice(`正在批量解析 ${lines.length} 条对标链接...`);
    const newItems: BatchRemakeItem[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const parsed = await api.parseBenchmarkVideo({ share_url: lines[i] });
        const char = pickCharacterForIndex(queue.length + i);
        newItems.push({
          id: `remake_${Date.now()}_${i}`,
          sourceLabel: parsed.title,
          sourceType: "link",
          rawUrl: lines[i],
          localVideoPath: parsed.local_video_path,
          previewImage: parsed.scene_preview_image,
          durationSec: parsed.duration_sec,
          downloadSucceeded: parsed.download_succeeded,
          warningNote: parsed.warning_note,
          scriptText: parsed.rewritten_script,
          characterId: char.id,
          status: "PENDING",
          progress: 0,
          stageMessage: parsed.download_succeeded ? "原片已解析就绪" : "链接下载受限",
        });
      } catch (err) {
        setNotice(`第 ${i + 1} 条链接解析异常: ${String(err)}`);
      }
    }

    setQueue((prev) => [...prev, ...newItems]);
    setBulkLinksText("");
    setParsingLinks(false);
    setNotice(`批量解析完成，已加入 ${newItems.length} 条复刻任务到右侧队列`);
  };

  const handleUploadBulkVideos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingVideos(true);
    setNotice(`正在批量导入并提取 ${files.length} 个本地视频...`);

    const added: BatchRemakeItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const up = await api.uploadAvatarMedia(f, "video");
        const parsed = await api.parseBenchmarkVideo({ local_video_path: up.file_path });
        const char = pickCharacterForIndex(queue.length + i);
        added.push({
          id: `remake_up_${Date.now()}_${i}`,
          sourceLabel: f.name,
          sourceType: "upload",
          localVideoPath: parsed.local_video_path,
          previewImage: parsed.scene_preview_image,
          durationSec: parsed.duration_sec,
          downloadSucceeded: true,
          warningNote: "",
          scriptText: parsed.rewritten_script,
          characterId: char.id,
          status: "PENDING",
          progress: 0,
          stageMessage: "本地原片已就绪",
        });
      } catch (err) {
        setNotice(`视频 ${f.name} 导入失败: ${String(err)}`);
      }
    }
    setQueue((prev) => [...prev, ...added]);
    setUploadingVideos(false);
    setNotice(`已成功批量导入 ${added.length} 个本地原视频！`);
    e.target.value = "";
  };

  const executeSingleItem = async (item: BatchRemakeItem) => {
    const char = characters.find((c) => c.id === item.characterId) || activePool[0];
    setQueue((prev) =>
      prev.map((q) =>
        q.id === item.id ? { ...q, status: "RUNNING", progress: 0.08, stageMessage: "正在提交任务...", errorMsg: "" } : q
      )
    );

    try {
      const sub = await api.submitAvatarTask({
        text: item.scriptText,
        voice_name: char.voice,
        audio_mode: audioMode,
        driving_video_path: item.localVideoPath,
        face_image_path: char.imagePath,
        animate_mode: animateMode,
        resolution,
        use_relighting_lora: true,
        avatar_name: char.name,
        sub_mode: animateMode,
        subtitle_style: subtitleStyle,
      });

      while (true) {
        await new Promise((r) => setTimeout(r, 1400));
        const st = await api.getAvatarTask(sub.task_id);
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, progress: st.progress, stageMessage: st.message } : q
          )
        );
        if (st.status === "SUCCEEDED" && st.result) {
          const doneItem: BatchRemakeItem = {
            ...item,
            status: "DONE",
            progress: 1,
            stageMessage: "复刻完成",
            outputVideoPath: st.result.video_path,
            outputDuration: st.result.duration_sec,
            engineNote: st.result.engine_note,
          };
          setQueue((prev) => prev.map((q) => (q.id === item.id ? doneItem : q)));
          setPreviewItem(doneItem);
          return;
        }
        if (st.status === "FAILED") {
          throw new Error(st.error || st.message || "任务失败");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: "FAILED", stageMessage: "执行失败", errorMsg: msg } : q
        )
      );
    }
  };

  const handleRunAllBatch = async () => {
    setRunningBatch(true);
    setNotice("正在按队列顺序批量执行人物替换复刻...");
    for (const item of queue) {
      if (item.status !== "DONE") {
        await executeSingleItem(item);
      }
    }
    setRunningBatch(false);
    setNotice("全部批量复刻任务执行完成！可点击「一键打包下载 ZIP」导出全部成片");
  };

  const completedPaths = queue.filter((q) => q.status === "DONE" && q.outputVideoPath).map((q) => q.outputVideoPath!);

  const handleDownloadZip = async () => {
    if (completedPaths.length === 0) return;
    setZipping(true);
    try {
      await api.downloadBatchZip(completedPaths, `batch-remake-${completedPaths.length}videos.zip`);
    } catch (err) {
      setNotice("打包下载失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setZipping(false);
    }
  };

  const getCharById = (id: string) => characters.find((c) => c.id === id) || activePool[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-4">
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-ink flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-apple-blue" />
              <span>1. 导入目标人物照（支持 1 张或多张轮询）</span>
            </div>
            <button
              onClick={() => charInputRef.current?.click()}
              disabled={uploadingChars}
              className="text-[11px] font-semibold text-apple-blue hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              <span>{uploadingChars ? "上传中..." : "批量上传人物照"}</span>
            </button>
            <input
              ref={charInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={handleUploadCharacters}
              className="hidden"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {characters.map((c) => {
              const imgSrc = c.isCustom ? getStreamUrl(c.imagePath) : c.imagePath;
              const isSelected = assignMode === "single" && activeCharId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveCharId(c.id)}
                  className={`p-1.5 pr-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                    isSelected || (assignMode === "round_robin" && c.isCustom)
                      ? "border-apple-blue bg-apple-blue/5 ring-1 ring-apple-blue"
                      : "border-border-subtle bg-canvas"
                  }`}
                >
                  <img src={imgSrc} alt={c.name} className="w-8 h-8 rounded-md object-cover shrink-0" />
                  <div className="text-left">
                    <div className="text-[11px] font-bold text-ink max-w-[76px] truncate">{c.name}</div>
                    <div className="text-[9px] text-ink-muted">{c.isCustom ? "自定义上传" : "预设形象"}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px] border-t border-border-subtle">
            <span className="text-ink-muted">人物分配方式：</span>
            <div className="flex gap-1.5">
              {[
                { id: "round_robin", label: "多张人物自动轮询" },
                { id: "single", label: "全部用当前选中人物" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setAssignMode(m.id as "single" | "round_robin")}
                  className={`px-2 py-0.5 rounded border cursor-pointer ${
                    assignMode === m.id
                      ? "border-apple-blue bg-apple-blue/10 text-apple-blue font-semibold"
                      : "border-border-subtle text-ink-muted bg-canvas"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-apple-blue" />
              <span>2. 批量导入原视频（多条链接 或 多选 MP4）</span>
            </div>
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={uploadingVideos}
              className="px-2.5 py-1 rounded bg-apple-blue/10 text-apple-blue text-[11px] font-semibold flex items-center gap-1 cursor-pointer hover:bg-apple-blue/20"
            >
              <Upload className="w-3 h-3" />
              <span>{uploadingVideos ? "导入中..." : "批量上传多个 MP4"}</span>
            </button>
            <input
              ref={videoInputRef}
              type="file"
              multiple
              accept="video/mp4,video/quicktime,video/webm"
              onChange={handleUploadBulkVideos}
              className="hidden"
            />
          </div>

          <textarea
            rows={4}
            value={bulkLinksText}
            onChange={(e) => setBulkLinksText(e.target.value)}
            placeholder={"粘贴多条抖音/快手/小红书分享口令或视频链接（每行一条），例如：\nhttps://v.douyin.com/xxxx1/\nhttps://v.douyin.com/xxxx2/"}
            className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-canvas text-ink resize-none"
          />

          <button
            onClick={handleParseBulkLinks}
            disabled={parsingLinks || !bulkLinksText.trim()}
            className="w-full py-2 rounded-lg bg-surface-muted hover:bg-canvas border border-border-subtle text-xs font-semibold text-ink flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {parsingLinks ? <Loader2 className="w-3.5 h-3.5 animate-spin text-apple-blue" /> : <Link2 className="w-3.5 h-3.5 text-apple-blue" />}
            <span>{parsingLinks ? "正在逐条解析链接并提取原片..." : "批量解析以上链接并加入队列"}</span>
          </button>
        </div>

        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="text-xs font-bold text-ink">3. 批量复刻全局参数</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-ink-muted block mb-1">替换模式</label>
              <select
                value={animateMode}
                onChange={(e) => setAnimateMode(e.target.value as "replace" | "move")}
                className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
              >
                <option value="replace">人物替换 (保留原场景)</option>
                <option value="move">动作迁移 (驱动肖像)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-muted block mb-1">声音处理</label>
              <select
                value={audioMode}
                onChange={(e) => setAudioMode(e.target.value as "keep_original" | "tts_replace")}
                className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
              >
                <option value="keep_original">保留原片人声</option>
                <option value="tts_replace">自动洗稿 + 新配音</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-muted block mb-1">字幕样式</label>
              <select
                value={subtitleStyle}
                onChange={(e) => setSubtitleStyle(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
              >
                <option value="douyin_yellow">抖音高燃金黄描边</option>
                <option value="clean_white">纯净白字阴影</option>
                <option value="none">不压制字幕</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-muted block mb-1">输出画质</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as "720p" | "480p")}
                className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
              >
                <option value="720p">720P 高清</option>
                <option value="480p">480P 极速批量</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 space-y-4">
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-ink">
                批量复刻队列（已完成 {completedPaths.length} / 总计 {queue.length} 条）
              </h3>
              {notice && <p className="text-[11px] text-apple-blue mt-0.5">{notice}</p>}
            </div>
            <div className="flex items-center gap-2">
              {completedPaths.length > 0 && (
                <button
                  onClick={handleDownloadZip}
                  disabled={zipping}
                  className="px-3.5 py-2 rounded-lg bg-apple-green text-surface text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{zipping ? "打包中..." : `一键打包下载 ZIP (${completedPaths.length})`}</span>
                </button>
              )}
              <button
                onClick={handleRunAllBatch}
                disabled={runningBatch || queue.length === 0}
                className="px-4 py-2 rounded-lg bg-ink text-surface text-xs font-semibold shadow-soft flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {runningBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin text-apple-blue" /> : <Sparkles className="w-3.5 h-3.5 text-apple-blue" />}
                <span>{runningBatch ? "批量替换中..." : "一键启动全部复刻"}</span>
              </button>
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="py-12 px-4 rounded-lg border-2 border-dashed border-border-subtle bg-canvas text-center space-y-1.5">
              <Film className="w-8 h-8 text-ink-subtle mx-auto" />
              <div className="text-xs font-semibold text-ink">批量队列为空</div>
              <div className="text-[11px] text-ink-muted">
                在左侧批量粘贴多条对标链接，或一次多选上传多个本地 MP4 原视频即可自动排期
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {queue.map((item, idx) => {
                const char = getCharById(item.characterId);
                const charSrc = char.isCustom ? getStreamUrl(char.imagePath) : char.imagePath;
                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg bg-canvas border border-border-subtle flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-ink-subtle w-5 shrink-0">#{idx + 1}</span>
                      {item.previewImage ? (
                        <img
                          src={getStreamUrl(item.previewImage)}
                          alt="scene"
                          className="w-10 h-14 rounded object-cover bg-black shrink-0 border border-border-subtle"
                        />
                      ) : (
                        <div className="w-10 h-14 rounded bg-surface-muted shrink-0 flex items-center justify-center">
                          <Film className="w-4 h-4 text-ink-subtle" />
                        </div>
                      )}
                      <img
                        src={charSrc}
                        alt={char.name}
                        title={`替换人物：${char.name}`}
                        className="w-9 h-9 rounded-full object-cover shrink-0 border-2 border-apple-blue"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-ink truncate">{item.sourceLabel}</span>
                          <span className="text-[10px] text-ink-muted shrink-0">({item.durationSec}s)</span>
                          {item.status === "DONE" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-apple-green/10 text-apple-green font-medium shrink-0">
                              已完成
                            </span>
                          )}
                          {item.status === "RUNNING" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-apple-blue/10 text-apple-blue animate-pulse shrink-0">
                              {Math.round(item.progress * 100)}%
                            </span>
                          )}
                          {item.status === "FAILED" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 shrink-0">
                              失败
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-muted truncate flex items-center gap-1">
                          {!item.downloadSucceeded && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                          <span>{item.errorMsg || item.stageMessage}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.outputVideoPath ? (
                        <>
                          <button
                            onClick={() => setPreviewItem(item)}
                            className="px-2.5 py-1 text-xs rounded border border-border-subtle bg-surface cursor-pointer"
                          >
                            对比
                          </button>
                          <a
                            href={getStreamUrl(item.outputVideoPath, true)}
                            download={`remake-${idx + 1}.mp4`}
                            className="px-2 py-1 text-xs rounded bg-apple-blue text-surface flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                          </a>
                        </>
                      ) : (
                        <button
                          onClick={() => executeSingleItem(item)}
                          disabled={item.status === "RUNNING"}
                          className="px-2.5 py-1 text-xs rounded border border-border-subtle bg-surface cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${item.status === "RUNNING" ? "animate-spin" : ""}`} />
                          <span>{item.status === "FAILED" ? "重试" : "单跑"}</span>
                        </button>
                      )}
                      <button
                        onClick={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
                        className="p-1 text-ink-subtle hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {previewItem?.outputVideoPath && (
            <div className="pt-3 border-t border-border-subtle space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-apple-green flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>原片 vs 替换成片对比 · {previewItem.sourceLabel}</span>
                </span>
                <button
                  onClick={() =>
                    api
                      .saveAsset({
                        file_path: previewItem.outputVideoPath,
                        kind: "video",
                        title: `批量复刻 · ${previewItem.sourceLabel.slice(0, 16)}`,
                      })
                      .then(() => alert("已存入素材库"))
                  }
                  className="text-ink-muted hover:text-ink flex items-center gap-1 cursor-pointer"
                >
                  <FolderArchive className="w-3.5 h-3.5" /> 存入素材库
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <video
                  key={previewItem.localVideoPath}
                  src={getStreamUrl(previewItem.localVideoPath)}
                  controls
                  muted
                  className="w-full h-[260px] rounded-lg bg-black object-contain border border-border-subtle"
                />
                <video
                  key={previewItem.outputVideoPath}
                  src={getStreamUrl(previewItem.outputVideoPath)}
                  controls
                  autoPlay
                  className="w-full h-[260px] rounded-lg bg-black object-contain border border-apple-green/40"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
