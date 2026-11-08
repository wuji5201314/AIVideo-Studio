export interface SubTool {
  id: string;
  name: string;
  description: string;
  badge?: string;
  badgeColor?: "blue" | "green" | "amber" | "purple";
  isFreeLocal: boolean;
  operatorId?: string;
}

export interface NavModule {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  tools: SubTool[];
}

export const MODULES_REGISTRY: NavModule[] = [
  {
    id: "01-home",
    title: "首页",
    subtitle: "快捷入口 · 运行看板",
    iconName: "Home",
    tools: [
      {
        id: "quick_workbench",
        name: "新建节点化成片工程",
        description: "启动多节点可反馈视频工作台，全流程按镜调控",
        badge: "核心推荐",
        badgeColor: "blue",
        isFreeLocal: false,
      },
    ],
  },
  {
    id: "02-avatar",
    title: "数字人",
    subtitle: "口播 · 复刻 · 换脸",
    iconName: "UserCheck",
    tools: [
      {
        id: "avatar_fast",
        name: "一键 / 批量数字人",
        description: "输入文案与形象，批量队列生成多主播口播成片",
        badge: "新手入口",
        badgeColor: "green",
        isFreeLocal: true,
        operatorId: "op_digital_human",
      },
      {
        id: "avatar_remake",
        name: "对标复刻数字人",
        description: "4步向导：对标抽帧 → 形象替换 → 文案仿写 → 对口型",
        badge: "4步向导",
        badgeColor: "purple",
        isFreeLocal: false,
      },
      {
        id: "avatar_lipsync",
        name: "视频对口型",
        description: "保留原视频肢体与眼神，仅替换嘴型匹配新音频",
        isFreeLocal: true,
      },
    ],
  },
  {
    id: "03-video-gen",
    title: "视频生成",
    subtitle: "节点成片 · 运镜 · 补帧",
    iconName: "Video",
    tools: [
      {
        id: "workbench_12nodes",
        name: "智能成片（多节点工作台）",
        description: "12节点 DAG 编排，支持锁镜改稿、按句调音、秒换BGM",
        badge: "旗舰主力",
        badgeColor: "blue",
        isFreeLocal: false,
      },
      {
        id: "image_motion",
        name: "静图运镜（Ken Burns）",
        description: "零成本将静态图片转换为推拉摇移 7 种电影感镜头",
        badge: "纯本机免费",
        badgeColor: "green",
        isFreeLocal: true,
        operatorId: "op_image_motion",
      },
    ],
  },
  {
    id: "04-motion-design",
    title: "动画设计",
    subtitle: "文字动效 · 标题卡",
    iconName: "Sparkles",
    tools: [
      {
        id: "motion_text_card",
        name: "文字/标题卡动画",
        description: "逐行上浮、居中标题卡、动感撞击字，本机 2 秒直出",
        badge: "本机不花钱",
        badgeColor: "green",
        isFreeLocal: true,
        operatorId: "op_motion_text",
      },
    ],
  },
  {
    id: "05-video-edit",
    title: "视频编辑",
    subtitle: "智能切气口 · 高清放大",
    iconName: "Scissors",
    tools: [
      {
        id: "cut_silence",
        name: "口播智能切气口",
        description: "自动识别停顿与无声段，一键切除紧凑成片",
        badge: "高频刚需",
        badgeColor: "green",
        isFreeLocal: true,
        operatorId: "op_smart_editor",
      },
      {
        id: "crop_vertical",
        name: "智能转竖屏 (9:16)",
        description: "横屏视频自动识别主体居中裁剪为竖屏短视频",
        isFreeLocal: true,
        operatorId: "op_smart_editor",
      },
      {
        id: "upscale_hd",
        name: "画质高清放大 (2x/4x)",
        description: "Lanczos 算法超分辨率放大并增强边缘细节",
        isFreeLocal: true,
        operatorId: "op_smart_editor",
      },
    ],
  },
  {
    id: "06-image-studio",
    title: "图片创作",
    subtitle: "封面排版 · Qwen精修",
    iconName: "Image",
    tools: [
      {
        id: "platform_cover",
        name: "小红书/抖音封面设计",
        description: "高清生成底图 + 本地二次可编辑中文大字排版层",
        badge: "免乱码",
        badgeColor: "blue",
        isFreeLocal: true,
      },
    ],
  },
  {
    id: "07-voice-studio",
    title: "声音工具",
    subtitle: "多音色 · 10s克隆 · 方言",
    iconName: "Mic",
    tools: [
      {
        id: "voice_tts",
        name: "多音色配音工坊",
        description: "Edge-TTS 普通话与方言自然合成，支持语速音量微调",
        badge: "免费原生",
        badgeColor: "green",
        isFreeLocal: true,
        operatorId: "op_voice_tts",
      },
      {
        id: "voice_clone",
        name: "10秒声音克隆",
        description: "上传一段短音频，零样本提取专属音色并永久存入素材库",
        badge: "VoxCPM/Fish",
        badgeColor: "purple",
        isFreeLocal: true,
      },
    ],
  },
  {
    id: "08-copywriter",
    title: "文案工具",
    subtitle: "详情页 · 仿写 · 分镜",
    iconName: "PenTool",
    tools: [
      {
        id: "pure_script",
        name: "一键成片 · 脚本打磨",
        description: "只出结构化分镜不出片，满意后一键直接送去视频工作台",
        badge: "送入工作台",
        badgeColor: "blue",
        isFreeLocal: false,
        operatorId: "op_script_storyboard",
      },
    ],
  },
  {
    id: "09-asset-library",
    title: "素材库",
    subtitle: "人物 · 音色 · 资产",
    iconName: "FolderArchive",
    tools: [
      {
        id: "hub_characters",
        name: "统一资产池",
        description: "集中管理数字人底模、克隆音色、历史镜头与片头片段",
        isFreeLocal: true,
      },
    ],
  },
];
