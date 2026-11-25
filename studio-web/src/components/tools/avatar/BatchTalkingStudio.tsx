import React, { useState } from "react";
import {
  Sparkles,
  Download,
  FolderArchive,
  CheckCircle2,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import { api, getStreamUrl } from "../../../services/api";

interface BatchTaskItem {
  id: string;
  title: string;
  script: string;
  avatarName: string;
  avatarTag: string;
  avatarImg: string;
  voiceName: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  videoPath?: string;
  durationSec?: number;
  engineNote?: string;
}

const ANCHORS = [
  {
    name: "活力小琳",
    tag: "好物带货 · 亲和热情",
    voice: "zh-CN-XiaoxiaoNeural",
    img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "极客阿辰",
    tag: "数码科技 · 沉稳口播",
    voice: "zh-CN-YunxiNeural",
    img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "商务顾总",
    tag: "实体商业 · 权威深度",
    voice: "zh-CN-YunjianNeural",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
  },
];

export const BatchTalkingStudio: React.FC = () => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [subtitleStyle, setSubtitleStyle] = useState("douyin_yellow");
  const [fissionTopic, setFissionTopic] = useState("");
  const [newScript, setNewScript] = useState("");
  const [runningAll, setRunningAll] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [queue, setQueue] = useState<BatchTaskItem[]>([
    {
      id: "batch_1",
      title: "口播任务 #1 · 痛点开场",
      script: "实体店做短视频最容易踩的3个大坑：盲目拍风景、没有真实人设、缺少成交钩子。",
      avatarName: ANCHORS[0].name,
      avatarTag: ANCHORS[0].tag,
      avatarImg: ANCHORS[0].img,
      voiceName: ANCHORS[0].voice,
      status: "PENDING",
    },
  ]);

  const handleFission = () => {
    const topic = fissionTopic.trim() || "实体店短视频获客";
    const angles = [
      { tag: "痛点反转", text: `为什么你每天拍「${topic}」还是没询盘？因为你缺的不是拍摄设备，而是能留住人的黄金前3秒！` },
      { tag: "实操干货", text: `今天30秒教你做好「${topic}」：第一步展示真实场景，第二步讲清核心卖点，第三步用低门槛钩子引导私信！` },
      { tag: "避坑指南", text: `新手做「${topic}」千万别踩这3个坑：盲目跟风、只讲价格、不看复盘数据，快收藏起来对照检查。` },
    ];
    setQueue(
      angles.map((a, i) => {
        const anchor = ANCHORS[i % ANCHORS.length];
        return {
          id: `batch_${Date.now()}_${i}`,
          title: `裂变 #${i + 1} · ${a.tag}`,
          script: a.text,
          avatarName: anchor.name,
          avatarTag: anchor.tag,
          avatarImg: anchor.img,
          voiceName: anchor.voice,
          status: "PENDING",
        };
      })
    );
  };

  const handleAdd = () => {
    if (!newScript.trim()) return;
    const anchor = ANCHORS[selectedIdx];
    setQueue((prev) => [
      ...prev,
      {
        id: `batch_${Date.now()}`,
        title: `口播任务 #${prev.length + 1} · ${anchor.name}`,
        script: newScript.trim(),
        avatarName: anchor.name,
        avatarTag: anchor.tag,
        avatarImg: anchor.img,
        voiceName: anchor.voice,
        status: "PENDING",
      },
    ]);
    setNewScript("");
  };

  const runItem = async (item: BatchTaskItem) => {
    setQueue((prev) => prev.map((t) => (t.id === item.id ? { ...t, status: "RUNNING" } : t)));
    try {
      const res = await api.executeOperator<{
        video_path: string;
        duration_sec: number;
        engine_note?: string;
      }>("op_digital_human", {
        text: item.script,
        voice_name: item.voiceName,
        face_image_path: item.avatarImg,
        animate_mode: "move",
        avatar_name: item.avatarName,
        avatar_tag: item.avatarTag,
        sub_mode: "fast",
        subtitle_style: subtitleStyle,
      });
      if (res?.video_path) {
        setQueue((prev) =>
          prev.map((t) =>
            t.id === item.id
              ? {
                  ...t,
                  status: "DONE",
                  videoPath: res.video_path,
                  durationSec: res.duration_sec,
                  engineNote: res.engine_note,
                }
              : t
          )
        );
        setPreviewVideo(res.video_path);
      }
    } catch {
      setQueue((prev) => prev.map((t) => (t.id === item.id ? { ...t, status: "FAILED" } : t)));
    }
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    for (const item of queue) {
      if (item.status !== "DONE") {
        await runItem(item);
      }
    }
    setRunningAll(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-4">
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="text-xs font-bold text-ink">1. 选择默认出镜主播与字幕风格</div>
          <div className="grid grid-cols-3 gap-2">
            {ANCHORS.map((a, i) => (
              <div
                key={a.name}
                onClick={() => setSelectedIdx(i)}
                className={`p-2 rounded-lg border text-center cursor-pointer ${
                  selectedIdx === i ? "border-apple-blue bg-apple-blue/5" : "border-border-subtle bg-canvas"
                }`}
              >
                <img src={a.img} alt={a.name} className="w-10 h-10 rounded-full mx-auto object-cover mb-1" />
                <div className="text-xs font-bold text-ink truncate">{a.name}</div>
              </div>
            ))}
          </div>
          <select
            value={subtitleStyle}
            onChange={(e) => setSubtitleStyle(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
          >
            <option value="douyin_yellow">抖音高燃金黄描边字幕</option>
            <option value="clean_white">纯净白字阴影字幕</option>
            <option value="none">不压制字幕</option>
          </select>
        </div>

        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="text-xs font-bold text-ink">2. 主题一键裂变 / 手动录入队列</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={fissionTopic}
              onChange={(e) => setFissionTopic(e.target.value)}
              placeholder="输入行业主题，如：实体家具店、跨境电商..."
              className="flex-1 text-xs p-2 rounded-lg border border-border-subtle bg-canvas text-ink"
            />
            <button
              onClick={handleFission}
              className="px-3 py-2 bg-apple-blue text-surface text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Wand2 className="w-3.5 h-3.5" /> 裂变3条
            </button>
          </div>

          <textarea
            rows={3}
            value={newScript}
            onChange={(e) => setNewScript(e.target.value)}
            placeholder="或手动输入单条口播文案..."
            className="w-full text-xs p-2.5 rounded-lg border border-border-subtle bg-canvas text-ink resize-none"
          />
          <button
            onClick={handleAdd}
            disabled={!newScript.trim()}
            className="w-full py-2 rounded-lg border border-border-subtle bg-surface-muted text-xs font-semibold text-ink flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> 加入批量队列
          </button>
        </div>
      </div>

      <div className="lg:col-span-7 space-y-4">
        <div className="p-4 bg-surface rounded-apple border border-border-subtle shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">3. 批量口播队列 ({queue.length})</span>
            <button
              onClick={handleRunAll}
              disabled={runningAll || queue.length === 0}
              className="px-4 py-2 rounded-lg bg-ink text-surface text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-apple-blue" />
              <span>{runningAll ? "批量合成中..." : "一键批量合成"}</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {queue.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-canvas border border-border-subtle flex items-start justify-between gap-2"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink">{item.title}</span>
                    {item.status === "DONE" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-apple-green/10 text-apple-green font-medium">
                        完成 {item.durationSec}s
                      </span>
                    )}
                    {item.status === "RUNNING" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-apple-blue/10 text-apple-blue animate-pulse">
                        合成中...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted line-clamp-2">{item.script}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.videoPath ? (
                    <>
                      <button
                        onClick={() => setPreviewVideo(item.videoPath || null)}
                        className="px-2.5 py-1 text-xs rounded border border-border-subtle bg-surface cursor-pointer"
                      >
                        播放
                      </button>
                      <a
                        href={getStreamUrl(item.videoPath, true)}
                        download={`${item.title}.mp4`}
                        className="px-2.5 py-1 text-xs rounded bg-apple-green text-surface flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> 下载
                      </a>
                    </>
                  ) : (
                    <button
                      onClick={() => runItem(item)}
                      disabled={item.status === "RUNNING"}
                      className="px-2.5 py-1 text-xs rounded border border-border-subtle bg-surface cursor-pointer"
                    >
                      单条合成
                    </button>
                  )}
                  <button
                    onClick={() => setQueue((prev) => prev.filter((t) => t.id !== item.id))}
                    className="p-1 text-ink-subtle hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {previewVideo && (
            <div className="p-3 rounded-lg bg-canvas border border-border-subtle space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-apple-green flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 成片实时预览
                </span>
                <button
                  onClick={() =>
                    api
                      .saveAsset({ file_path: previewVideo, kind: "video", title: "批量数字人口播成片" })
                      .then(() => alert("已存入素材库"))
                  }
                  className="text-ink-muted hover:text-ink flex items-center gap-1 cursor-pointer"
                >
                  <FolderArchive className="w-3.5 h-3.5" /> 存入素材库
                </button>
              </div>
              <video
                key={previewVideo}
                src={getStreamUrl(previewVideo)}
                controls
                autoPlay
                className="w-full max-h-[320px] rounded bg-black object-contain"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
