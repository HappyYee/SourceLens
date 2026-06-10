// 连接器入口：把一条 binding 解析成 feed URL，并用通用 rss-parser 抓取 + 标准化。
// 几乎所有 v0 数据源都能化成 RSS/Atom，零 key。

import Parser from "rss-parser";
import { buildArxivUrl } from "./arxiv";
import { buildGithubUrl } from "./github";
import {
  buildYoutubeUrl,
  collectVideoIds,
  extractChannelId,
  extractHandle,
  extractVideoId,
  parseISO8601Duration,
  youtubeKindFromDuration,
  youtubeRssUrl,
} from "./youtube";
import { normalizeEntry, type NormalizedItem, type RawEntry } from "../normalize";
import { proxyDispatcher, setupProxy } from "../proxy";
import { isHttpProxyUrl } from "../proxy-url";
import { truncate } from "../text.ts";
import type { Dispatcher } from "undici";

export interface BindingLike {
  platform: string;
  feedUrl: string | null;
  query: string | null;
}

/** 把 binding 的存储字段解析为可抓取的 feed URL。 */
export function resolveFeedUrl(b: BindingLike): string | null {
  switch (b.platform) {
    case "rss":
    case "podcast":
      return b.feedUrl?.trim() || null;
    case "youtube":
      return b.feedUrl?.trim() ? buildYoutubeUrl(b.feedUrl) : null;
    case "github":
      return b.feedUrl?.trim() ? buildGithubUrl(b.feedUrl) : null;
    case "arxiv":
      return b.query?.trim() ? buildArxivUrl(b.query) : null;
    case "bilibili":
    case "x":
      return b.feedUrl?.trim() || null; // 存的是 mid / handle，由 fetcher 专用分流处理
    default:
      return null; // manual
  }
}

const parser = new Parser({
  timeout: 15_000,
  headers: { "User-Agent": "SourceLens/0.1 (+local)" },
  customFields: {
    item: [
      ["media:thumbnail", "media:thumbnail"],
      ["media:content", "media:content"],
      ["itunes:duration", "itunes:duration"],
      ["itunes:image", "itunes:image"],
      ["content:encoded", "content:encoded"],
      ["yt:videoId", "yt:videoId"],
    ],
  },
});

setupProxy(); // 进程内仅一次：让所有 fetch 走 HTTPS_PROXY/HTTP_PROXY/ALL_PROXY

type FetchInit = RequestInit & { dispatcher?: Dispatcher };

function ytDispatcher(proxyUrl?: string): Dispatcher | undefined {
  return isHttpProxyUrl(proxyUrl) ? proxyDispatcher(proxyUrl as string) : undefined;
}

function ytFetchInit(init: RequestInit, proxyUrl?: string): FetchInit {
  const dispatcher = ytDispatcher(proxyUrl);
  return dispatcher ? { ...init, dispatcher } : init;
}

function youtubeNetworkError(e: unknown): Error {
  const m = e instanceof Error ? e.message : String(e);
  if (e instanceof Error && (e.name === "TimeoutError" || /timeout|aborted|connect/i.test(m))) {
    return new Error("请求超时（dev 是否在导出了 HTTPS_PROXY 的同一 shell 里启动？）");
  }
  return new Error(`网络错误：${m}（国外刷新需要可用的 http 代理）`);
}

// 统一用 fetch 取文本（受代理控制），再交给 rss-parser 解析字符串
// —— rss-parser 自带的 parseURL 走 Node http/https，不认代理，会超时。
async function fetchText(url: string, proxyUrl?: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, ytFetchInit({
      headers: { "user-agent": "SourceLens/0.1 (+local)" },
      signal: AbortSignal.timeout(20_000),
    }, proxyUrl));
  } catch (e) {
    throw youtubeNetworkError(e);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** 把用户输入解析成 UC 频道 ID：UC… / @handle / 频道 URL 均可（@handle 需 key）。 */
async function resolveChannelId(input: string, apiKey?: string, proxyUrl?: string): Promise<string> {
  const direct = extractChannelId(input);
  if (direct) return direct;

  const handle = extractHandle(input);
  if (handle) {
    if (!apiKey) {
      throw new Error("解析 @handle 需要 YOUTUBE_API_KEY（在 .env 配置后重启 dev）");
    }
    const u = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent("@" + handle)}&key=${apiKey}`;
    let res: Response;
    try {
      res = await fetch(u, ytFetchInit({ signal: AbortSignal.timeout(20_000) }, proxyUrl));
    } catch (e) {
      throw youtubeNetworkError(e);
    }
    const data = (await res.json().catch(() => ({}))) as {
      error?: { code?: number; message?: string };
      items?: { id?: string }[];
    };
    if (data.error) throw new Error(`YouTube API ${data.error.code}：${data.error.message}`);
    if (!res.ok) throw new Error(`YouTube API ${res.status}（解析 @${handle} 失败）`);
    const id = data.items?.[0]?.id;
    if (!id) throw new Error(`找不到频道 @${handle}`);
    return id;
  }

  throw new Error("无法解析频道：请填 UC… 频道 ID、@handle 或频道链接");
}

/** 抓取并标准化一个 feed。 */
export async function fetchFeed(
  url: string,
  isPodcast = false,
): Promise<NormalizedItem[]> {
  const feed = await parser.parseString(await fetchText(url));
  const out: NormalizedItem[] = [];
  for (const e of feed.items ?? []) {
    const n = normalizeEntry(e as unknown as RawEntry, { isPodcast });
    if (n) out.push(n);
  }
  return out;
}

const ARXIV_PAGE = 50;

/**
 * arXiv 多页抓取（全部/范围刷新用）：按提交时间倒序逐页翻，
 * 翻到比 since 更早、或没有更多、或到 maxPages 上限就停。
 */
export async function fetchArxivPaged(
  query: string,
  since?: Date,
  maxPages = 8,
): Promise<NormalizedItem[]> {
  const out: NormalizedItem[] = [];
  for (let page = 0; page < maxPages; page++) {
    const url = buildArxivUrl(query, ARXIV_PAGE, page * ARXIV_PAGE);
    const feed = await parser.parseString(await fetchText(url));
    const items = (feed.items ?? [])
      .map((e) => normalizeEntry(e as unknown as RawEntry))
      .filter((n): n is NormalizedItem => n !== null);
    if (items.length === 0) break;
    out.push(...items);
    const oldest = items[items.length - 1].publishedAt;
    if (since && oldest < since) break; // 已翻过 since
    if (items.length < ARXIV_PAGE) break; // 没有更多
  }
  return out;
}

const YT_VIDEOS_API = "https://www.googleapis.com/youtube/v3/videos";

interface YtMeta {
  durationSec: number | null;
  channelTitle?: string;
  thumbnailUrl?: string;
}

/** 调 YouTube Data API videos.list（每批 50 个 id）补时长/缩略图/频道名。失败的批留空（partial）。 */
async function fetchYouTubeMeta(
  ids: string[],
  apiKey: string,
  proxyUrl?: string,
): Promise<Map<string, YtMeta>> {
  const map = new Map<string, YtMeta>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = `${YT_VIDEOS_API}?part=contentDetails,snippet&id=${chunk.join(",")}&key=${apiKey}`;
    const res = await fetch(url, ytFetchInit({}, proxyUrl));
    if (!res.ok) continue;
    const data: unknown = await res.json();
    const items = (data as { items?: unknown[] }).items ?? [];
    for (const raw of items) {
      const it = raw as {
        id?: string;
        contentDetails?: { duration?: string };
        snippet?: {
          channelTitle?: string;
          thumbnails?: Record<string, { url?: string }>;
        };
      };
      if (!it.id) continue;
      const th = it.snippet?.thumbnails ?? {};
      const thumb = (th.maxres ?? th.standard ?? th.high ?? th.medium ?? th.default)?.url;
      map.set(it.id, {
        durationSec: parseISO8601Duration(it.contentDetails?.duration),
        channelTitle: it.snippet?.channelTitle,
        thumbnailUrl: thumb,
      });
    }
  }
  return map;
}

/**
 * YouTube 完整抓取：RSS 发现新视频 → Data API 批量补时长/缩略图/频道名。
 * 无 key 或 API 失败时仍返回卡片（时长留空，partial），绝不阻断。
 */
export async function fetchYouTube(
  channelInput: string,
  apiKey?: string,
  proxyUrl?: string,
): Promise<NormalizedItem[]> {
  const channelId = await resolveChannelId(channelInput, apiKey, proxyUrl);
  const feed = await parser.parseString(await fetchText(youtubeRssUrl(channelId), proxyUrl));
  const rows: { n: NormalizedItem; videoId: string | null }[] = [];
  for (const e of feed.items ?? []) {
    const n = normalizeEntry(e as unknown as RawEntry);
    if (!n) continue;
    const raw = e as unknown as RawEntry;
    const ytId = typeof raw["yt:videoId"] === "string" ? (raw["yt:videoId"] as string) : "";
    const guid = typeof raw.guid === "string" ? raw.guid : "";
    const videoId = extractVideoId(ytId || raw.link || guid || n.externalId);
    if (videoId) n.externalId = videoId; // 用稳定 videoId 作 externalId（upsert 去重键）
    rows.push({ n, videoId });
  }

  if (apiKey) {
    const ids = rows.map((r) => r.videoId).filter((v): v is string => !!v);
    if (ids.length > 0) {
      try {
        const meta = await fetchYouTubeMeta(ids, apiKey, proxyUrl);
        for (const r of rows) {
          const m = r.videoId ? meta.get(r.videoId) : undefined;
          if (!m) continue;
          if (m.durationSec != null) r.n.durationSec = m.durationSec;
          if (!r.n.thumbnailUrl && m.thumbnailUrl) r.n.thumbnailUrl = m.thumbnailUrl;
          if (!r.n.author && m.channelTitle) r.n.author = m.channelTitle;
        }
      } catch {
        // API 整体失败 → 保留 RSS 卡片，时长留空
      }
    }
  }

  for (const r of rows) r.n.youtubeKind = youtubeKindFromDuration(r.n.durationSec);
  return rows.map((r) => r.n);
}

/* ------------------------- YouTube Backfill（历史回溯） ------------------------- */

const YT_API = "https://www.googleapis.com/youtube/v3";

async function ytApiJson(url: string, proxyUrl?: string): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, ytFetchInit({ signal: AbortSignal.timeout(20_000) }, proxyUrl));
  } catch (e) {
    throw youtubeNetworkError(e);
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: { code?: number; message?: string; errors?: { reason?: string }[] };
    [k: string]: unknown;
  };
  if (data.error) {
    const reason = data.error.errors?.[0]?.reason;
    if (reason === "quotaExceeded") throw new Error("YouTube API 配额已用尽（quota exceeded）");
    throw new Error(`YouTube API ${data.error.code ?? res.status}：${data.error.message ?? ""}`);
  }
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  return data;
}

interface ChannelInfo {
  channelId: string;
  channelTitle: string;
  uploadsPlaylistId: string;
  videoCount: number | null;
}

async function resolveChannelInfo(sourceInput: string, apiKey: string, proxyUrl?: string): Promise<ChannelInfo> {
  const cid = extractChannelId(sourceInput);
  const handle = cid ? null : extractHandle(sourceInput);
  const selector = cid
    ? `id=${cid}`
    : handle
      ? `forHandle=${encodeURIComponent("@" + handle)}`
      : null;
  if (!selector) throw new Error("无法解析频道：请填 UC… 频道 ID、@handle 或频道链接");

  const data = (await ytApiJson(
    `${YT_API}/channels?part=snippet,contentDetails,statistics&${selector}&key=${apiKey}`,
    proxyUrl,
  )) as {
    items?: {
      id: string;
      snippet?: { title?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
      statistics?: { videoCount?: string };
    }[];
  };
  const ch = data.items?.[0];
  if (!ch) throw new Error(cid ? `找不到频道 ${cid}` : `找不到频道 @${handle}`);
  const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error("该频道没有 uploads 播放列表");
  return {
    channelId: ch.id,
    channelTitle: ch.snippet?.title ?? "",
    uploadsPlaylistId: uploads,
    videoCount: ch.statistics?.videoCount ? Number(ch.statistics.videoCount) : null,
  };
}

export interface BackfillResult {
  videos: NormalizedItem[];
  fetchedCount: number;
  pageCount: number;
  hasMore: boolean;
  channelTitle: string;
}

/** 回溯频道历史：channels.list 拿 uploads 列表 → playlistItems 分页 → videos.list 批量补元数据。 */
export async function backfillYouTubeChannel(opts: {
  sourceInput: string;
  apiKey?: string;
  limit: number;
  proxyUrl?: string;
}): Promise<BackfillResult> {
  const { sourceInput, apiKey, limit, proxyUrl } = opts;
  if (!apiKey) throw new Error("缺少 YOUTUBE_API_KEY（在 .env 配置后重启 dev）");

  const info = await resolveChannelInfo(sourceInput, apiKey, proxyUrl);

  const { ids, pageCount, hasMore } = await collectVideoIds(async (pageToken) => {
    const u = `${YT_API}/playlistItems?part=contentDetails&playlistId=${info.uploadsPlaylistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ""}&key=${apiKey}`;
    const data = (await ytApiJson(u, proxyUrl)) as {
      items?: { contentDetails?: { videoId?: string } }[];
      nextPageToken?: string;
    };
    const pageIds = (data.items ?? [])
      .map((it) => it.contentDetails?.videoId)
      .filter((v): v is string => typeof v === "string");
    return { ids: pageIds, nextPageToken: data.nextPageToken };
  }, limit);

  const videos: NormalizedItem[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = (await ytApiJson(
      `${YT_API}/videos?part=snippet,contentDetails,status&id=${chunk.join(",")}&key=${apiKey}`,
      proxyUrl,
    )) as {
      items?: {
        id: string;
        snippet?: {
          title?: string;
          description?: string;
          channelTitle?: string;
          publishedAt?: string;
          thumbnails?: Record<string, { url?: string }>;
        };
        contentDetails?: { duration?: string };
      }[];
    };
    for (const v of data.items ?? []) {
      const sn = v.snippet ?? {};
      const th = sn.thumbnails ?? {};
      const thumb = (th.maxres ?? th.standard ?? th.high ?? th.medium ?? th.default)?.url ?? null;
      const desc =
        typeof sn.description === "string"
          ? truncate(sn.description.replace(/\s+/g, " ").trim(), 200)
          : "";
      const durationSec = parseISO8601Duration(v.contentDetails?.duration);
      videos.push({
        externalId: v.id,
        title: sn.title?.trim() || null,
        excerpt: desc || null,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnailUrl: thumb,
        durationSec,
        author: sn.channelTitle ?? info.channelTitle ?? null,
        publishedAt: sn.publishedAt ? new Date(sn.publishedAt) : new Date(),
        raw: JSON.stringify(v),
        youtubeKind: youtubeKindFromDuration(durationSec),
      });
    }
  }

  return { videos, fetchedCount: ids.length, pageCount, hasMore, channelTitle: info.channelTitle };
}

export interface PlaylistTagResult {
  tagMap: Map<string, string[]>; // videoId → 播放列表标题[]
  playlistCount: number;
  channelId: string;
}

const MAX_PLAYLISTS = 200; // 安全上限，避免极端频道失控

/** 读取频道公开播放列表，构造 videoId→播放列表标题 映射。只读取、不导入任何东西。 */
export async function fetchChannelPlaylistTags(opts: {
  sourceInput: string;
  apiKey?: string;
  proxyUrl?: string;
}): Promise<PlaylistTagResult> {
  const { sourceInput, apiKey, proxyUrl } = opts;
  if (!apiKey) throw new Error("缺少 YOUTUBE_API_KEY（在 .env 配置后重启 dev）");
  const info = await resolveChannelInfo(sourceInput, apiKey, proxyUrl);

  // 1) 频道的公开播放列表
  const playlists: { id: string; title: string }[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const data = (await ytApiJson(
      `${YT_API}/playlists?part=snippet&channelId=${info.channelId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ""}&key=${apiKey}`,
      proxyUrl,
    )) as {
      items?: { id: string; snippet?: { title?: string } }[];
      nextPageToken?: string;
    };
    for (const p of data.items ?? []) {
      playlists.push({ id: p.id, title: p.snippet?.title ?? p.id });
    }
    pageToken = data.nextPageToken;
  } while (pageToken && playlists.length < MAX_PLAYLISTS);

  // 2) 每个播放列表里的 videoId → 标题
  const tagMap = new Map<string, string[]>();
  for (const pl of playlists) {
    let token: string | undefined = undefined;
    do {
      const data = (await ytApiJson(
        `${YT_API}/playlistItems?part=contentDetails&playlistId=${pl.id}&maxResults=50${token ? `&pageToken=${token}` : ""}&key=${apiKey}`,
        proxyUrl,
      )) as {
        items?: { contentDetails?: { videoId?: string } }[];
        nextPageToken?: string;
      };
      for (const it of data.items ?? []) {
        const vid = it.contentDetails?.videoId;
        if (!vid) continue;
        const arr = tagMap.get(vid) ?? [];
        if (!arr.includes(pl.title)) arr.push(pl.title);
        tagMap.set(vid, arr);
      }
      token = data.nextPageToken;
    } while (token);
  }

  return { tagMap, playlistCount: playlists.length, channelId: info.channelId };
}
