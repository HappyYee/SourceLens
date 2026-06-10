// Phase 0 写死的示例数据，1:1 对应 reference/prototype.html 的 rooms / nav。
// 时间戳由 now 动态生成，保证"今天/昨天/更早"分组演示稳定。Phase 1 起改为 DB 查询。

import type { ItemVM, Platform, RoomType, RoomVM } from "./types";

interface SampleItem {
  kind: Platform;
  title?: string | null;
  aiTitle?: string | null;
  desc: string;
  dayOffset: number;
  minutesAgo?: number; // 仅 dayOffset=0 用：保证在"今天"且为过去
  hh?: number;
  mm?: number;
  durationSec?: number;
  thumbVariant?: number;
}

interface SampleRoom {
  id: string;
  name: string;
  type: RoomType;
  importance: number;
  bindings: Platform[];
  items: SampleItem[];
}

const SAMPLE: SampleRoom[] = [
  {
    id: "elon",
    name: "Elon Musk",
    type: "人物",
    importance: 5,
    bindings: ["x", "youtube", "rss"],
    items: [
      { kind: "x", aiTitle: "关于 Starship 下次试飞窗口的简短更新", desc: "示例推文 · 原文无标题，由 AI 拟题", dayOffset: 0, minutesAgo: 120 },
      { kind: "youtube", title: "示例：发射任务全程回放", desc: "频道更新 · 含发射与回收画面", dayOffset: 0, minutesAgo: 300, durationSec: 2538, thumbVariant: 0 },
      { kind: "x", aiTitle: "转发了一条关于能源存储的图表", desc: "示例推文 · 引用转发", dayOffset: 1, hh: 23, mm: 40 },
      { kind: "rss", title: "示例博客：年度技术路线说明", desc: "个人站点更新 · 长文", dayOffset: 1, hh: 18, mm: 2 },
      { kind: "youtube", title: "示例：工厂参观短片", desc: "频道更新", dayOffset: 3, hh: 10, mm: 0, durationSec: 535, thumbVariant: 3 },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    type: "公司",
    importance: 5,
    bindings: ["rss", "x"],
    items: [
      { kind: "rss", title: "示例：新模型发布说明", desc: "官方博客 · 产品公告", dayOffset: 0, minutesAgo: 60 },
      { kind: "x", title: "示例推文：研究方向更新", desc: "官方账号", dayOffset: 0, minutesAgo: 180 },
      { kind: "rss", title: "示例：可解释性研究新进展", desc: "研究博客", dayOffset: 1, hh: 15, mm: 30 },
    ],
  },
  {
    id: "dario",
    name: "Dario Amodei",
    type: "人物",
    importance: 4,
    bindings: ["x", "rss"],
    items: [
      { kind: "x", aiTitle: "对一篇行业报告的简短评论", desc: "示例推文 · AI 拟题", dayOffset: 0, minutesAgo: 240 },
      { kind: "rss", title: "示例长文：关于扩展规律的思考", desc: "个人随笔", dayOffset: 4, hh: 13, mm: 0 },
    ],
  },
  {
    id: "aresearch",
    name: "Anthropic Research",
    type: "子集",
    importance: 3,
    bindings: ["arxiv", "rss"],
    items: [
      { kind: "arxiv", title: "示例论文：一种新的对齐方法", desc: "arXiv cs.AI · 预印本", dayOffset: 0, minutesAgo: 360 },
      { kind: "arxiv", title: "示例论文：长上下文评测基准", desc: "arXiv cs.CL", dayOffset: 2, hh: 11, mm: 0 },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    type: "公司",
    importance: 4,
    bindings: ["rss", "x"],
    items: [
      { kind: "rss", title: "示例：产品更新日志", desc: "官方博客", dayOffset: 0, minutesAgo: 300 },
      { kind: "x", title: "示例推文：开发者公告", desc: "官方账号", dayOffset: 1, hh: 20, mm: 15 },
    ],
  },
  {
    id: "xai",
    name: "xAI",
    type: "公司",
    importance: 3,
    bindings: ["x", "rss"],
    items: [
      { kind: "x", aiTitle: "发布了一段产品演示", desc: "示例推文 · AI 拟题", dayOffset: 0, minutesAgo: 150 },
    ],
  },
  {
    id: "lecun",
    name: "Yann LeCun",
    type: "人物",
    importance: 4,
    bindings: ["x", "arxiv"],
    items: [
      { kind: "x", aiTitle: "关于世界模型的一段长推文", desc: "示例推文 · AI 拟题", dayOffset: 0, minutesAgo: 200 },
      { kind: "arxiv", title: "示例论文：自监督表征学习", desc: "arXiv · 合作者", dayOffset: 1, hh: 14, mm: 0 },
    ],
  },
  {
    id: "karpathy",
    name: "Andrej Karpathy",
    type: "人物",
    importance: 3,
    bindings: ["x", "youtube"],
    items: [
      { kind: "youtube", title: "示例：从零实现一个小型模型", desc: "教学视频更新", dayOffset: 0, minutesAgo: 90, durationSec: 7110, thumbVariant: 1 },
      { kind: "x", aiTitle: "分享了一份学习路线笔记", desc: "示例推文 · AI 拟题", dayOffset: 1, hh: 9, mm: 30 },
    ],
  },
  {
    id: "llmpod",
    name: "某 AI 播客",
    type: "节目",
    importance: 2,
    bindings: ["podcast", "rss"],
    items: [
      { kind: "podcast", title: "示例：第 112 期 · 与一位研究员对谈", desc: "播客更新", dayOffset: 1, hh: 21, mm: 0, durationSec: 4360 },
    ],
  },
];

function publishedAt(now: Date, s: SampleItem): string {
  if (s.dayOffset === 0 && s.minutesAgo != null) {
    return new Date(now.getTime() - s.minutesAgo * 60_000).toISOString();
  }
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - s.dayOffset);
  d.setHours(s.hh ?? 12, s.mm ?? 0, 0, 0);
  return d.toISOString();
}

export function getSampleRooms(now: Date = new Date()): RoomVM[] {
  return SAMPLE.map((r) => ({
    id: r.id,
    name: r.name,
    nodeKind: "room",
    type: r.type,
    typeLabel: r.type,
    importance: r.importance,
    bindings: r.bindings,
    items: r.items.map<ItemVM>((s, i) => ({
      id: `${r.id}-${i}`,
      platform: s.kind,
      title: s.title ?? null,
      aiTitle: s.aiTitle ?? null,
      excerpt: s.desc,
      url: "#",
      thumbnailUrl: null,
      thumbVariant: s.thumbVariant ?? null,
      durationSec: s.durationSec ?? null,
      author: null,
      publishedAt: publishedAt(now, s),
    })),
  }));
}

export function getSampleRoomMap(now: Date = new Date()): Record<string, RoomVM> {
  const map: Record<string, RoomVM> = {};
  for (const r of getSampleRooms(now)) map[r.id] = r;
  return map;
}

