// 统一的视图模型类型。Phase 0 由 sample-data 产出；Phase 1+ 由 DB 查询产出，结构一致。

export type Platform =
  | "rss"
  | "youtube"
  | "bilibili"
  | "arxiv"
  | "github"
  | "podcast"
  | "x"
  | "manual";

/** X 帖子媒体（只存缩略图引用，不下载文件）。 */
export interface XMedia {
  type: "photo" | "video" | "gif";
  thumb: string | null;
}
/** 外链卡片。 */
export interface LinkCard {
  url: string;
  domain: string;
  title: string | null;
}

export type RoomType = string; // roomType key（自定义，存于 RoomType 表）

/** 标准化后的内容条目（启动器卡片的数据）。publishedAt 是时间线归并排序键。 */
export interface ItemVM {
  id: string;
  platform: Platform;
  title: string | null;
  aiTitle: string | null;
  customTitle?: string | null;
  titleSource?: string | null;
  youtubeKind?: string | null; // short | video | unknown
  youtubePlaylistTags?: string[]; // 播放列表分类标签
  videoKind?: string | null; // short | video | unknown（通用视频，如 Bilibili）
  postKind?: string | null; // text|image|video|link|quote|reply|repost|thread|unknown（X）
  platformTags?: string[]; // 通用平台标签（B 站合集/分区/标签）
  media?: XMedia[]; // X 媒体缩略图
  linkCards?: LinkCard[]; // X 外链卡片
  excerpt: string | null;
  url: string;
  thumbnailUrl?: string | null;
  /** 仅 Phase 0 示例：缩略图渐变变体 0..3（真实数据用 thumbnailUrl）。 */
  thumbVariant?: number | null;
  durationSec?: number | null;
  author?: string | null;
  /** ISO 字符串，方便在 server→client 间序列化传递。 */
  publishedAt: string;
  /** 档案可用性（Phase 3b）：available | unavailable | unknown；null/缺省=从未评估。 */
  availability?: string | null;
  /** 首次"源头确认缺失"时间（ISO），仅 unavailable 时有意义。 */
  missingSince?: string | null;
}

/** 一个节点：folder(分区) 或 room(内容房间)。room 才聚合 Source 时间线。 */
export interface RoomVM {
  id: string;
  name: string;
  nodeKind: string; // folder | room（结构类型）
  type: string | null; // roomType key（room 用；folder 为 null）
  typeLabel: string | null; // roomType 显示名（folder 为 null）
  importance: number; // 1..5
  bindings: Platform[];
  items: ItemVM[];
}

/* ---------- 左侧导航树 ---------- */
export interface NavRow {
  id: string;
  name: string;
  nodeKind: string; // folder | room
  parentId: string | null;
  sortOrder: number;
  importance: number;
  updCount: number;
  roomType: string | null;
  typeLabel: string | null;
}
export interface NavTreeNode {
  row: NavRow;
  children: NavTreeNode[];
}

export interface NavData {
  tree: NavTreeNode[];
  stats: { sources: number; updated: number };
}

/** 内容类型（roomType）视图模型，带使用中的 room 数。 */
export interface RoomTypeVM {
  key: string;
  displayName: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  builtin: boolean;
  usageCount: number;
}
