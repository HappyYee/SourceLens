// 解析结果 → 标准 Item 字段。纯函数，无外部依赖，可被 node --test 直跑。
// rss-parser 同时支持 RSS 与 Atom；这里只负责把它产出的条目对象映射成统一形状。

export interface RawEntry {
  title?: string;
  link?: string;
  guid?: string;
  id?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  "content:encoded"?: string;
  contentSnippet?: string;
  summary?: string;
  creator?: string;
  author?: string;
  enclosure?: { url?: string; type?: string; length?: string };
  "media:thumbnail"?: unknown;
  "media:content"?: unknown;
  "itunes:duration"?: string | number;
  "itunes:image"?: unknown;
  [key: string]: unknown;
}

export interface NormalizedItem {
  externalId: string;
  title: string | null;
  excerpt: string | null;
  url: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  author: string | null;
  publishedAt: Date;
  raw?: string | null; // 可选原始 payload（backfill 时存 videos.list 条目）
  youtubeKind?: string | null; // short | video | unknown（仅 youtube）
  videoKind?: string | null; // short | video | unknown（通用视频，如 Bilibili）
  postKind?: string | null; // text|image|video|link|quote|reply|repost|thread|unknown（X）
  platformTags?: string[] | null; // 通用平台标签（B 站合集/分区/标签）
  media?: unknown; // 结构化媒体（写库时 JSON.stringify）
  linkCards?: unknown; // 结构化外链卡片（写库时 JSON.stringify）
}

const EXCERPT_MAX = 200;

export function stripHtml(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** itunes:duration 可能是 "HH:MM:SS"、"MM:SS" 或纯秒数。返回秒；无效返回 null。 */
export function parseDuration(v?: string | number | null): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
  const s = v.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n > 0 ? n : null;
  }
  const parts = s.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  const sec = parts.reduce((a, b) => a * 60 + b, 0);
  return sec > 0 ? sec : null;
}

function extractUrl(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const x of v) {
      const u = extractUrl(x);
      if (u) return u;
    }
    return null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const dollar = o["$"] as Record<string, unknown> | undefined;
    if (dollar && typeof dollar.url === "string") return dollar.url;
    if (dollar && typeof dollar.href === "string") return dollar.href;
    if (typeof o.url === "string") return o.url;
    if (typeof o.href === "string") return o.href;
  }
  return null;
}

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i;

export function pickThumbnail(e: RawEntry): string | null {
  return (
    extractUrl(e["media:thumbnail"]) ||
    extractUrl(e["media:content"]) ||
    extractUrl(e["itunes:image"]) ||
    (e.enclosure?.url &&
    (e.enclosure.type?.startsWith("image") || IMAGE_EXT.test(e.enclosure.url))
      ? e.enclosure.url
      : null)
  );
}

/**
 * 标准化一条解析结果。opts.isPodcast 时解析 itunes:duration（YouTube 留空）。
 * externalId 缺失则返回 null（无法去重的条目丢弃）。
 */
export function normalizeEntry(
  e: RawEntry,
  opts?: { isPodcast?: boolean },
): NormalizedItem | null {
  const guid = typeof e.guid === "string" ? e.guid : "";
  const externalId = guid || e.id || e.link || "";
  if (!externalId) return null;

  const url = e.link || e.id || guid || externalId;

  const dateStr = e.isoDate || e.pubDate;
  let publishedAt = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(+publishedAt)) publishedAt = new Date();

  const rawExcerpt =
    (e.contentSnippet && e.contentSnippet.trim()) ||
    stripHtml(e["content:encoded"] as string) ||
    stripHtml(e.content) ||
    stripHtml(e.summary);
  const excerpt = rawExcerpt ? rawExcerpt.slice(0, EXCERPT_MAX) : null;

  return {
    externalId,
    title: e.title?.trim() || null,
    excerpt,
    url,
    thumbnailUrl: pickThumbnail(e),
    durationSec: opts?.isPodcast ? parseDuration(e["itunes:duration"]) : null,
    author: e.creator || e.author || null,
    publishedAt,
  };
}
