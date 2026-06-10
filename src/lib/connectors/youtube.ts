// YouTube：channel_id → RSS feed（含 media:thumbnail；时长 RSS 取不到，靠 Data API 补）。已是 URL 则原样返回。
export function buildYoutubeUrl(input: string): string {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) return s;
  // 形如 UCxxxx 的频道 ID，或退化处理为 channel_id
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(s)}`;
}

/** 从 watch?v= / youtu.be / yt:video:ID / 裸 11 位 ID 中抽出 videoId。纯函数。 */
export function extractVideoId(s: string): string | null {
  if (!s) return null;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/,
    /yt:video:([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

/** ISO-8601 时长（如 PT1H2M3S / P1DT2H）→ 秒。无效返回 null。纯函数。 */
export function parseISO8601Duration(s?: string | null): number | null {
  if (!s) return null;
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(s.trim());
  if (!m) return null;
  const d = Number(m[1] ?? 0);
  const h = Number(m[2] ?? 0);
  const min = Number(m[3] ?? 0);
  const sec = Number(m[4] ?? 0);
  const total = ((d * 24 + h) * 60 + min) * 60 + sec;
  return total > 0 ? total : null;
}

/** 从输入直接拿 UC 频道 ID：UC… 或 .../channel/UC… 。拿不到返回 null。纯函数。 */
export function extractChannelId(input: string): string | null {
  const s = (input || "").trim();
  const fromFeed = s.match(/[?&]channel_id=(UC[\w-]{22})/); // feeds/videos.xml?channel_id=UC…
  if (fromFeed) return fromFeed[1];
  const fromPath = s.match(/channel\/(UC[\w-]{22})/); // youtube.com/channel/UC…
  if (fromPath) return fromPath[1];
  if (/^UC[\w-]{22}$/.test(s)) return s; // 裸 UC… ID
  return null;
}

/** 从输入拿 @handle（@x 或 youtube.com/@x），返回不带 @ 的 handle；拿不到返回 null。纯函数。 */
export function extractHandle(input: string): string | null {
  const m = (input || "").trim().match(/(?:youtube\.com\/)?@([A-Za-z0-9_.-]+)/i);
  return m ? m[1] : null;
}

export function youtubeRssUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

/** 视频类型判定：<=60s 为 short，>60s 为 video，缺失/<=0 为 unknown。导入优先，不准用 unknown。纯函数。 */
export function youtubeKindFromDuration(
  durationSec?: number | null,
): "short" | "video" | "unknown" {
  if (durationSec == null || !Number.isFinite(durationSec) || durationSec <= 0) {
    return "unknown";
  }
  return durationSec <= 60 ? "short" : "video";
}

/**
 * 由 videoId→播放列表标题 的映射，给"已导入的视频"生成标签分配。
 * 只覆盖 importedVideoIds（非本频道上传的视频不在其中，自然不被打标签）。
 * 已导入但不在任何播放列表的视频 → 空数组（用于清除旧标签）。纯函数。
 */
export function buildPlaylistTagAssignments(
  importedVideoIds: string[],
  tagMap: Map<string, string[]>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const id of importedVideoIds) {
    const tags = tagMap.get(id) ?? [];
    out.set(id, [...new Set(tags)]); // 去重，保序
  }
  return out;
}

/** 回溯上限解析："all"→无限，数字→该数，非法→默认 100。纯函数。 */
export function resolveBackfillLimit(limit: number | string): number {
  if (typeof limit === "string" && /^all$/i.test(limit)) return Number.POSITIVE_INFINITY;
  const n = typeof limit === "number" ? limit : parseInt(limit, 10);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

/** 上传播放列表 ID 可由频道 ID 推出：UC… → UU…（备用，主用 channels.list 返回值）。纯函数。 */
export function uploadsPlaylistFromChannelId(channelId: string): string | null {
  return /^UC[\w-]{22}$/.test(channelId) ? "UU" + channelId.slice(2) : null;
}

/**
 * 分页累计 videoId，直到达到 limit 或没有下一页。
 * fetchPage 由调用方提供（注入网络），因此本函数纯、可测。
 */
export async function collectVideoIds(
  fetchPage: (
    pageToken: string | undefined,
  ) => Promise<{ ids: string[]; nextPageToken?: string }>,
  limit: number,
): Promise<{ ids: string[]; pageCount: number; hasMore: boolean }> {
  const ids: string[] = [];
  let pageToken: string | undefined = undefined;
  let pageCount = 0;
  let hasMore = false;

  while (ids.length < limit) {
    const page = await fetchPage(pageToken);
    pageCount += 1;
    let brokeForLimit = false;
    for (const id of page.ids) {
      if (ids.length >= limit) {
        brokeForLimit = true;
        break;
      }
      ids.push(id);
    }
    if (ids.length >= limit) {
      hasMore = brokeForLimit || page.nextPageToken != null;
      break;
    }
    if (!page.nextPageToken) {
      hasMore = false;
      break;
    }
    pageToken = page.nextPageToken;
  }
  return { ids, pageCount, hasMore };
}
