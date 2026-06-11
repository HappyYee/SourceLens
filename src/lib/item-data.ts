// Item 写入数据构造（纯函数，可被 node --test 直跑）。
// 从 fetcher.upsertItems 抽出：customTitle / titleSource(custom) / youtubePlaylistTags
// 永不出现在这里——前两者归用户、后者归播放列表同步独占。
// lastSeenAt（Phase 3a）：每次 refresh/backfill 命中即写"最近出现时间"。
import type { NormalizedItem } from "./normalize.ts";

export interface ItemBindingRef {
  id: string;
  roomId: string;
  platform: string;
}

export interface ItemUpdateData {
  bindingId: string;
  platform: string;
  lastSeenAt: Date;
  title?: string | null;
  aiTitle?: string | null;
  excerpt?: string | null;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  author?: string | null;
  raw?: string | null;
  url?: string;
  youtubeKind?: string | null;
  videoKind?: string | null;
  postKind?: string | null;
  platformTags?: string | null;
  media?: string | null;
  linkCards?: string | null;
}

/** 把数组/对象序列化为 JSON；空数组 / null 返回 null（避免清空既有值）。 */
export function jsonOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? JSON.stringify(v) : null;
  return JSON.stringify(v);
}

/** update 路径：只更新有值的元数据，不因某次返回缺失而清空原字段。 */
export function buildItemUpdateData(
  binding: ItemBindingRef,
  it: NormalizedItem,
  aiTitle: string | null,
  seenAt: Date,
): ItemUpdateData {
  const data: ItemUpdateData = {
    bindingId: binding.id,
    platform: binding.platform,
    lastSeenAt: seenAt,
  };
  if (it.title != null) data.title = it.title;
  if (aiTitle != null) data.aiTitle = aiTitle;
  if (it.excerpt != null) data.excerpt = it.excerpt;
  if (it.thumbnailUrl != null) data.thumbnailUrl = it.thumbnailUrl;
  if (it.durationSec != null) data.durationSec = it.durationSec;
  if (it.author != null) data.author = it.author;
  if (it.raw != null) data.raw = it.raw;
  if (it.url) data.url = it.url;
  if (it.youtubeKind != null) data.youtubeKind = it.youtubeKind;
  if (it.videoKind != null) data.videoKind = it.videoKind;
  if (it.postKind != null) data.postKind = it.postKind;
  // JSON 字段只在有内容时写入，避免把既有标签/媒体清空
  const ptU = jsonOrNull(it.platformTags);
  if (ptU) data.platformTags = ptU;
  const mdU = jsonOrNull(it.media);
  if (mdU) data.media = mdU;
  const lcU = jsonOrNull(it.linkCards);
  if (lcU) data.linkCards = lcU;
  // 注意：从不写 youtubePlaylistTags（由播放列表同步独占），也从不写 customTitle；
  // availability/metadataStatus/missingSince 由 metadata checker（3b）独占，刷新无权写。
  return data;
}

/** create 路径：新条目全量字段。 */
export function buildItemCreateData(
  binding: ItemBindingRef,
  it: NormalizedItem,
  aiTitle: string | null,
  seenAt: Date,
) {
  return {
    bindingId: binding.id,
    roomId: binding.roomId,
    platform: binding.platform,
    externalId: it.externalId,
    title: it.title,
    aiTitle,
    titleSource: it.title ? "original" : it.excerpt ? "rule" : null,
    excerpt: it.excerpt,
    url: it.url,
    thumbnailUrl: it.thumbnailUrl,
    durationSec: it.durationSec,
    author: it.author,
    raw: it.raw ?? null,
    youtubeKind: it.youtubeKind ?? null,
    videoKind: it.videoKind ?? null,
    postKind: it.postKind ?? null,
    platformTags: jsonOrNull(it.platformTags),
    media: jsonOrNull(it.media),
    linkCards: jsonOrNull(it.linkCards),
    publishedAt: it.publishedAt,
    lastSeenAt: seenAt,
  };
}
