// 抓取调度：对到期 binding 抓取 → 标准化 → 按时间窗口过滤 → upsert 入库。
// 重要：按 (roomId, externalId) 去重；只新增/更新元数据，从不因源头删除而删本地条目，customTitle 永不覆盖。
import { prisma } from "./db";
import {
  backfillYouTubeChannel,
  fetchChannelPlaylistTags,
  FETCHABLE,
  fetchArxivPaged,
  fetchFeed,
  fetchYouTube,
  resolveFeedUrl,
} from "./connectors";
import {
  buildPlaylistTagAssignments,
  resolveBackfillLimit,
} from "./connectors/youtube";
import { collectBilibiliArchives } from "./connectors/bilibili-net";
import { parseBilibiliInput } from "./connectors/bilibili";
import { scrapeXUser } from "./connectors/x-scrape";
import { parseXInput } from "./connectors/xpost";
import { ruleTitle } from "./ai/title";
import { inWindow } from "./view";
import { assertDataDir } from "./storage";
import {
  networkHint,
  resolveRefreshNetwork,
  type ProxyMode,
  type RefreshNetwork,
  type RefreshRegion,
} from "./network";
import type { NormalizedItem } from "./normalize";

/** 刷新时的网络/登录上下文：通道（国内外+代理）+ 可选登录态 profile 目录。 */
interface AuthCtx {
  net: RefreshNetwork;
  profileDir?: string;
  proxyUrl?: string;
  useProxy: boolean;
}

/** 为某平台装配通道：bilibili/x 读其 AuthProfile（决定通道与代理、提供登录态目录）。 */
async function authCtxFor(platform: string): Promise<AuthCtx> {
  if (platform === "bilibili" || platform === "x") {
    const ap = await prisma.authProfile.findFirst({
      where: { platform },
      orderBy: { createdAt: "asc" },
    });
    const net = resolveRefreshNetwork({
      platform,
      refreshRegion: (ap?.refreshRegion as RefreshRegion) ?? "auto",
      proxyMode: (ap?.proxyMode as ProxyMode) ?? "system",
      proxyUrl: ap?.proxyUrl ?? undefined,
    });
    return {
      net,
      profileDir: ap?.profileDir,
      useProxy: net.shouldUseProxy,
      proxyUrl: net.shouldUseProxy ? net.proxyUrl : undefined,
    };
  }
  const net = resolveRefreshNetwork({ platform });
  return { net, useProxy: net.shouldUseProxy, proxyUrl: net.shouldUseProxy ? net.proxyUrl : undefined };
}

/** 通用回溯上限：50/100/300/all（all 给一个安全大上限）。 */
function clampBackfillLimit(limit: number | string, allCap: number): number {
  if (limit === "all") return allCap;
  const n = typeof limit === "number" ? limit : parseInt(String(limit), 10);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(n, allCap);
}

export interface RefreshWindow {
  since?: Date;
  until?: Date;
  deep?: boolean; // 是否向更早翻页（arxiv 多页）
}

export interface RefreshResult {
  bindingId: string;
  platform: string;
  added: number;
  updated: number;
  error?: string;
  networkLabel?: string;
  hint?: string;
}

type BindingRow = {
  id: string;
  roomId: string;
  platform: string;
  feedUrl: string | null;
  query: string | null;
};

async function fetchForBinding(
  binding: BindingRow,
  window: RefreshWindow | undefined,
  ctx: AuthCtx,
): Promise<NormalizedItem[]> {
  if (binding.platform === "youtube") {
    if (!binding.feedUrl?.trim()) {
      throw new Error("YouTube 绑定需要频道 ID（UC… 开头）或 feed URL");
    }
    return fetchYouTube(binding.feedUrl, process.env.YOUTUBE_API_KEY);
  }
  if (binding.platform === "bilibili") {
    const mid = parseBilibiliInput(binding.feedUrl || "");
    if (!mid) throw new Error("无法解析 B 站 UP 主：请填 mid 或 space.bilibili.com/{mid} 链接");
    const { videos } = await collectBilibiliArchives({
      mid,
      limit: 50, // 刷新最新：检查最近 50 条
      channel: { useProxy: ctx.useProxy, proxyUrl: ctx.proxyUrl, profileDir: ctx.profileDir },
    });
    return videos;
  }
  if (binding.platform === "x") {
    const handle = parseXInput(binding.feedUrl || "");
    if (!handle) throw new Error("无法解析 X 用户名：请填 @handle 或 x.com/{handle} 链接");
    if (!ctx.profileDir) {
      throw new Error("需要 X 登录态：请先在设置页创建 x 登录态并登录后重试");
    }
    const { videos } = await scrapeXUser({
      handle,
      profileDir: ctx.profileDir,
      proxyUrl: ctx.proxyUrl,
      targetCount: 40, // 刷新最新
    });
    return videos;
  }
  if (binding.platform === "arxiv" && binding.query && window?.deep) {
    return fetchArxivPaged(binding.query, window.since);
  }
  const url = resolveFeedUrl(binding);
  if (!url) throw new Error("无法解析 feed URL（检查 feedUrl / query）");
  return fetchFeed(url, binding.platform === "podcast");
}

/** 把数组/对象序列化为 JSON；空数组 / null 返回 null（避免清空既有值）。 */
function jsonOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? JSON.stringify(v) : null;
  return JSON.stringify(v);
}

/**
 * 按 (roomId, externalId) 去重写入：不存在则新建，存在则只更新有值的元数据。
 * 永不写入 customTitle / titleSource(custom)；不因某次返回缺失而清空原字段。
 */
async function upsertItems(
  binding: { id: string; roomId: string; platform: string },
  items: NormalizedItem[],
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  for (const it of items) {
    try {
      const aiTitle = !it.title && it.excerpt ? ruleTitle(it.excerpt) : null;
      const existing = await prisma.item.findUnique({
        where: { roomId_externalId: { roomId: binding.roomId, externalId: it.externalId } },
        select: { id: true },
      });
      if (existing) {
        const data: {
          bindingId: string;
          platform: string;
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
        } = { bindingId: binding.id, platform: binding.platform };
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
        // 注意：从不写 youtubePlaylistTags（由播放列表同步独占），也从不写 customTitle。
        await prisma.item.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await prisma.item.create({
          data: {
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
          },
        });
        added += 1;
      }
    } catch {
      // 单条失败（并发竞态等）不影响整体
    }
  }
  return { added, updated };
}

/** 抓取单条 binding，按窗口过滤后去重写入。 */
export async function refreshBinding(
  bindingId: string,
  window?: RefreshWindow,
): Promise<RefreshResult> {
  const binding = await prisma.sourceBinding.findUnique({ where: { id: bindingId } });
  if (!binding) return { bindingId, platform: "?", added: 0, updated: 0, error: "binding 不存在" };
  if (!binding.enabled || !FETCHABLE.has(binding.platform)) {
    return { bindingId, platform: binding.platform, added: 0, updated: 0 };
  }

  const ctx = await authCtxFor(binding.platform);
  const net = ctx.net;
  try {
    const fetched = await fetchForBinding(binding, window, ctx);
    const items = fetched.filter((it) =>
      inWindow(it.publishedAt, window?.since, window?.until),
    );
    const { added, updated } = await upsertItems(binding, items);
    await prisma.sourceBinding.update({
      where: { id: binding.id },
      data: { lastFetchedAt: new Date(), lastError: null },
    });
    return { bindingId, platform: binding.platform, added, updated, networkLabel: net.humanLabel };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.sourceBinding.update({
      where: { id: binding.id },
      data: { lastError: msg.slice(0, 300) },
    });
    return {
      bindingId,
      platform: binding.platform,
      added: 0,
      updated: 0,
      error: msg,
      networkLabel: net.humanLabel,
      hint: networkHint(net.region, msg),
    };
  }
}

/** 抓取所有（可选限定 room 的）到期 binding，套用同一时间窗口。 */
export async function refreshDue(opts?: {
  roomId?: string;
  since?: Date;
  until?: Date;
  deep?: boolean;
  force?: boolean;
}): Promise<{ bindings: number; added: number; updated: number; results: RefreshResult[] }> {
  assertDataDir(); // 外置盘未挂载则在此硬失败，绝不静默写错位置
  const bindings = await prisma.sourceBinding.findMany({
    where: { enabled: true, ...(opts?.roomId ? { roomId: opts.roomId } : {}) },
  });
  const now = Date.now();
  const window: RefreshWindow = {
    since: opts?.since,
    until: opts?.until,
    deep: opts?.deep,
  };
  const results: RefreshResult[] = [];
  let added = 0;
  let updated = 0;

  for (const b of bindings) {
    if (!FETCHABLE.has(b.platform)) continue;
    const due =
      opts?.force ||
      !b.lastFetchedAt ||
      (now - b.lastFetchedAt.getTime()) / 60_000 >= b.intervalMin;
    if (!due) continue;
    const r = await refreshBinding(b.id, window);
    results.push(r);
    added += r.added;
    updated += r.updated;
  }
  return { bindings: results.length, added, updated, results };
}

export interface BackfillCounts {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  fetchedCount: number;
  pageCount: number;
  hasMore: boolean;
  shortsCount: number;
  playlistTaggedCount: number;
  error?: string;
  networkLabel?: string;
  hint?: string;
}

const ZERO_BACKFILL: BackfillCounts = {
  createdCount: 0,
  updatedCount: 0,
  skippedCount: 0,
  fetchedCount: 0,
  pageCount: 0,
  hasMore: false,
  shortsCount: 0,
  playlistTaggedCount: 0,
};

/** 历史回溯：YouTube（uploads 分页）/ Bilibili（arc/search 分页）/ X（滚动）。同 refresh 的去重/保留语义。 */
export async function backfillBinding(
  bindingId: string,
  limit: number | string,
): Promise<BackfillCounts> {
  assertDataDir();
  const binding = await prisma.sourceBinding.findUnique({ where: { id: bindingId } });
  if (!binding) return { ...ZERO_BACKFILL, error: "binding 不存在" };
  const platform = binding.platform;
  if (platform !== "youtube" && platform !== "bilibili" && platform !== "x") {
    return { ...ZERO_BACKFILL, error: "回溯历史目前支持 YouTube / Bilibili / X source" };
  }
  const sourceInput = binding.feedUrl?.trim() || "";
  if (!sourceInput) {
    return { ...ZERO_BACKFILL, error: "该 source 缺少频道 / UP 主 / 用户标识" };
  }

  const ctx = await authCtxFor(platform);
  const net = ctx.net;
  try {
    if (platform === "bilibili") {
      const mid = parseBilibiliInput(sourceInput);
      if (!mid) throw new Error("无法解析 B 站 UP 主：请填 mid 或 space.bilibili.com/{mid} 链接");
      const { videos, fetchedCount, pageCount, hasMore } = await collectBilibiliArchives({
        mid,
        limit: clampBackfillLimit(limit, 2000),
        channel: { useProxy: ctx.useProxy, proxyUrl: ctx.proxyUrl, profileDir: ctx.profileDir },
      });
      const { added, updated } = await upsertItems(binding, videos);
      const shortsCount = videos.filter((v) => v.videoKind === "short").length;
      await prisma.sourceBinding.update({
        where: { id: binding.id },
        data: { lastFetchedAt: new Date(), lastError: null },
      });
      return {
        createdCount: added,
        updatedCount: updated,
        skippedCount: 0,
        fetchedCount,
        pageCount,
        hasMore,
        shortsCount,
        playlistTaggedCount: 0,
        networkLabel: net.humanLabel,
      };
    }

    if (platform === "x") {
      const handle = parseXInput(sourceInput);
      if (!handle) throw new Error("无法解析 X 用户名：请填 @handle 或 x.com/{handle} 链接");
      if (!ctx.profileDir) throw new Error("需要 X 登录态：请先在设置页创建 x 登录态并登录后重试");
      const target = clampBackfillLimit(limit, 600);
      const { videos, scannedCount } = await scrapeXUser({
        handle,
        profileDir: ctx.profileDir,
        proxyUrl: ctx.proxyUrl,
        targetCount: target,
      });
      const { added, updated } = await upsertItems(binding, videos);
      await prisma.sourceBinding.update({
        where: { id: binding.id },
        data: { lastFetchedAt: new Date(), lastError: null },
      });
      return {
        createdCount: added,
        updatedCount: updated,
        skippedCount: 0,
        fetchedCount: scannedCount,
        pageCount: 0,
        hasMore: videos.length >= target,
        shortsCount: 0,
        playlistTaggedCount: 0,
        networkLabel: net.humanLabel,
      };
    }

    // youtube
    const { videos, fetchedCount, pageCount, hasMore } = await backfillYouTubeChannel({
      sourceInput,
      apiKey: process.env.YOUTUBE_API_KEY,
      limit: resolveBackfillLimit(limit),
    });
    const { added, updated } = await upsertItems(binding, videos);
    const skippedCount = Math.max(0, fetchedCount - videos.length); // playlist 里有、videos.list 查不到(删/私密)
    const shortsCount = videos.filter((v) => v.youtubeKind === "short").length;
    await prisma.sourceBinding.update({
      where: { id: binding.id },
      data: { lastFetchedAt: new Date(), lastError: null },
    });
    // 导入后自动同步一次播放列表标签（best-effort；syncPlaylistTagsForBinding 会自行更新 binding 状态）
    let playlistTaggedCount = 0;
    try {
      const sync = await syncPlaylistTagsForBinding(binding.id);
      playlistTaggedCount = sync.taggedCount;
    } catch {
      // 标签同步失败不影响 backfill 主结果
    }
    return {
      createdCount: added,
      updatedCount: updated,
      skippedCount,
      fetchedCount,
      pageCount,
      hasMore,
      shortsCount,
      playlistTaggedCount,
      networkLabel: net.humanLabel,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.sourceBinding.update({
      where: { id: binding.id },
      data: { lastError: msg.slice(0, 300) },
    });
    return {
      ...ZERO_BACKFILL,
      error: msg,
      networkLabel: net.humanLabel,
      hint: networkHint(net.region, msg),
    };
  }
}

export interface PlaylistSyncResult {
  taggedCount: number;
  playlistCount: number;
  error?: string;
  networkLabel?: string;
  hint?: string;
}

/**
 * 同步该 YouTube source 的播放列表标签：
 * 读取频道公开播放列表 → 只给"本 source 已导入的视频"打标签（非本频道上传的不导入、不打标）。
 * 不创建任何 item；不影响视频卡片是否存在；customTitle / youtubeKind 不受影响。
 */
export async function syncPlaylistTagsForBinding(
  bindingId: string,
): Promise<PlaylistSyncResult> {
  const binding = await prisma.sourceBinding.findUnique({ where: { id: bindingId } });
  if (!binding) return { taggedCount: 0, playlistCount: 0, error: "binding 不存在" };
  if (binding.platform !== "youtube") {
    return { taggedCount: 0, playlistCount: 0, error: "同步播放列表标签仅支持 YouTube source" };
  }
  const sourceInput = binding.feedUrl?.trim() || "";
  if (!sourceInput) {
    return { taggedCount: 0, playlistCount: 0, error: "该 source 缺少频道 ID / @handle / 链接" };
  }

  const net = resolveRefreshNetwork({ platform: binding.platform });
  try {
    const { tagMap, playlistCount } = await fetchChannelPlaylistTags({
      sourceInput,
      apiKey: process.env.YOUTUBE_API_KEY,
    });
    // 仅本 source 已导入的 youtube 视频
    const items = await prisma.item.findMany({
      where: { roomId: binding.roomId, bindingId: binding.id, platform: "youtube" },
      select: { id: true, externalId: true },
    });
    const assignments = buildPlaylistTagAssignments(
      items.map((i) => i.externalId),
      tagMap,
    );
    let taggedCount = 0;
    for (const it of items) {
      const tags = assignments.get(it.externalId) ?? [];
      await prisma.item.update({
        where: { id: it.id },
        data: { youtubePlaylistTags: tags.length ? JSON.stringify(tags) : null },
      });
      if (tags.length) taggedCount += 1;
    }
    await prisma.sourceBinding.update({
      where: { id: binding.id },
      data: { lastError: null },
    });
    return { taggedCount, playlistCount, networkLabel: net.humanLabel };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.sourceBinding.update({
      where: { id: binding.id },
      data: { lastError: msg.slice(0, 300) },
    });
    return {
      taggedCount: 0,
      playlistCount: 0,
      error: msg,
      networkLabel: net.humanLabel,
      hint: networkHint(net.region, msg),
    };
  }
}
