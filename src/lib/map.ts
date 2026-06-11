// 纯映射逻辑：DB 行 → 视图模型。无 Prisma 依赖，可被 node --test 直跑。（导航树构建见 tree.ts）

import type { ItemVM, LinkCard, Platform, RoomVM, XMedia } from "./types";

export interface ItemRow {
  id: string;
  platform: string;
  title: string | null;
  aiTitle: string | null;
  customTitle?: string | null;
  titleSource?: string | null;
  youtubeKind?: string | null;
  youtubePlaylistTags?: string | null;
  videoKind?: string | null;
  postKind?: string | null;
  platformTags?: string | null;
  media?: string | null;
  linkCards?: string | null;
  excerpt: string | null;
  url: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  author: string | null;
  publishedAt: Date | string;
  availability?: string | null;
  missingSince?: Date | string | null;
}

export interface RoomRow {
  id: string;
  name: string;
  nodeKind: string;
  type: string | null;
  typeLabel?: string | null;
  importance: number;
  bindings: { platform: string }[];
  items: ItemRow[];
}

/** 解析 JSON 字符串数组 → string[]，非法返回 []。 */
function parsePlaylistTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseMedia(raw: string | null | undefined): XMedia[] {
  return parseJsonArray(raw).map((m) => {
    const o = (m ?? {}) as Record<string, unknown>;
    const t = o.type === "video" || o.type === "gif" ? (o.type as XMedia["type"]) : "photo";
    return { type: t, thumb: typeof o.thumb === "string" ? o.thumb : null };
  });
}

function parseLinkCards(raw: string | null | undefined): LinkCard[] {
  return parseJsonArray(raw)
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        url: typeof o.url === "string" ? o.url : "",
        domain: typeof o.domain === "string" ? o.domain : "",
        title: typeof o.title === "string" ? o.title : null,
      };
    })
    .filter((c) => c.url);
}

export function toItemVM(it: ItemRow): ItemVM {
  return {
    id: it.id,
    platform: it.platform as Platform,
    title: it.title,
    aiTitle: it.aiTitle,
    customTitle: it.customTitle ?? null,
    titleSource: it.titleSource ?? null,
    youtubeKind: it.youtubeKind ?? null,
    youtubePlaylistTags: parsePlaylistTags(it.youtubePlaylistTags),
    videoKind: it.videoKind ?? null,
    postKind: it.postKind ?? null,
    platformTags: parsePlaylistTags(it.platformTags),
    media: parseMedia(it.media),
    linkCards: parseLinkCards(it.linkCards),
    excerpt: it.excerpt,
    url: it.url,
    thumbnailUrl: it.thumbnailUrl ?? null,
    thumbVariant: null,
    durationSec: it.durationSec ?? null,
    author: it.author ?? null,
    publishedAt:
      typeof it.publishedAt === "string"
        ? it.publishedAt
        : it.publishedAt.toISOString(),
    availability: it.availability ?? null,
    missingSince:
      it.missingSince == null
        ? null
        : typeof it.missingSince === "string"
          ? it.missingSince
          : it.missingSince.toISOString(),
  };
}

/** 去重保序，得到该 Room 的平台列表（卡片图标用）。 */
export function distinctPlatforms(bindings: { platform: string }[]): Platform[] {
  const seen = new Set<string>();
  const out: Platform[] = [];
  for (const b of bindings) {
    if (!seen.has(b.platform)) {
      seen.add(b.platform);
      out.push(b.platform as Platform);
    }
  }
  return out;
}

export function toRoomVM(r: RoomRow): RoomVM {
  return {
    id: r.id,
    name: r.name,
    nodeKind: r.nodeKind,
    type: r.type ?? null,
    typeLabel: r.typeLabel ?? null,
    importance: r.importance,
    bindings: distinctPlatforms(r.bindings),
    items: r.items.map(toItemVM),
  };
}
