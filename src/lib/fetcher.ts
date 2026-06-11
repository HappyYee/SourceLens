// 抓取调度：对到期 binding 抓取 → 标准化 → 按时间窗口过滤 → upsert 入库。
// 重要：按 (roomId, externalId) 去重；只新增/更新元数据，从不因源头删除而删本地条目，customTitle 永不覆盖。
import { prisma } from "./db";
import {
  buildPlaylistTagAssignments,
  resolveBackfillLimit,
} from "./connectors/youtube";
import { ruleTitle } from "./ai/title";
import { pickAuthProfile } from "./authprofile.ts";
import { BrowserError } from "./browser.ts";
import { buildItemCreateData, buildItemUpdateData } from "./item-data.ts";
import { effectiveVideoKind, inWindow } from "./view";
import { assertDataDir } from "./storage";
import { truncate } from "./text.ts";
import { fetchablePlatforms, getAdapter } from "./platform/registry.ts";
import { classifyError, type ErrorCode, type FetchReport } from "./report.ts";
import {
  formatOutcome,
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
  authProfileId?: string;
  refreshRegion: RefreshRegion;
  profileDir?: string;
  proxyUrl?: string;
  useProxy: boolean;
}

/**
 * 为某平台装配通道：bilibili/x 读其 AuthProfile（决定通道与代理、提供登录态目录）。
 * Phase 3a：binding 可经 explicitProfileId 显式指定登录态；
 * 选择顺序 = 显式指定 → isDefault → createdAt asc（无人设置时与旧行为一致）。
 */
async function authCtxFor(platform: string, explicitProfileId?: string | null): Promise<AuthCtx> {
  if (platform === "bilibili" || platform === "x") {
    const profiles = await prisma.authProfile.findMany({ where: { platform } });
    const ap = pickAuthProfile(profiles, explicitProfileId);
    if (explicitProfileId && ap?.id !== explicitProfileId) {
      console.warn(
        `[auth] binding 指定的 AuthProfile 不存在（${explicitProfileId}），已回退平台默认`,
      );
    }
    const net = resolveRefreshNetwork({
      platform,
      refreshRegion: (ap?.refreshRegion as RefreshRegion) ?? "auto",
      proxyMode: (ap?.proxyMode as ProxyMode) ?? "system",
      proxyUrl: ap?.proxyUrl ?? undefined,
    });
    return {
      net,
      authProfileId: ap?.id,
      refreshRegion: (ap?.refreshRegion as RefreshRegion) ?? "auto",
      profileDir: ap?.profileDir,
      useProxy: net.shouldUseProxy,
      proxyUrl: net.shouldUseProxy ? net.proxyUrl : undefined,
    };
  }
  const net = resolveRefreshNetwork({ platform });
  return {
    net,
    refreshRegion: "auto",
    useProxy: net.shouldUseProxy,
    proxyUrl: net.shouldUseProxy ? net.proxyUrl : undefined,
  };
}

async function markAuthProfileLoggedIn(
  platform: string,
  id: string | undefined,
  ctx: AuthCtx,
): Promise<void> {
  if (!id) return;
  try {
    await prisma.authProfile.update({
      where: { id },
      data: {
        status: "logged_in",
        lastCheckedAt: new Date(),
        lastResult: formatOutcome({
          ok: true,
          action: "check_auth",
          platform,
          refreshRegion: ctx.refreshRegion,
          networkLabel: ctx.net.humanLabel,
        }),
      },
    });
  } catch {
    // 状态回写只用于清除误导性 UI，不影响抓取结果。
  }
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

/** 单 binding 刷新结果：统一信封 + 定位用的 bindingId。 */
export type BindingFetchReport = FetchReport & { bindingId: string };

type BindingRow = {
  id: string;
  roomId: string;
  platform: string;
  feedUrl: string | null;
  query: string | null;
  authProfileId: string | null;
};

async function fetchForBinding(
  binding: BindingRow,
  window: RefreshWindow | undefined,
  ctx: AuthCtx,
): Promise<NormalizedItem[]> {
  const adapter = getAdapter(binding.platform);
  if (!adapter) throw new Error(`不支持的平台：${binding.platform}`);
  // feedUrl 优先、query 兜底：feeds 存 feedUrl，arxiv 存 query，
  // x/bilibili/youtube 存 feedUrl；与旧 resolveFeedUrl 取值等价。
  const rawInput = binding.feedUrl?.trim() || binding.query?.trim() || "";
  const out = await adapter.refreshLatest(rawInput, {
    profileDir: ctx.profileDir,
    proxyUrl: ctx.proxyUrl,
    useProxy: ctx.useProxy,
    window: { since: window?.since, deep: window?.deep },
  });
  return out.items;
}

function writeFailureWarning(failed: number): string | null {
  return failed > 0 ? `${failed} 条写入失败（详见服务端日志）` : null;
}

function errorCodeFor(e: unknown, msg: string): ErrorCode {
  return classifyError(msg, e instanceof BrowserError ? e.code : undefined);
}

/**
 * 按 (roomId, externalId) 去重写入：不存在则新建，存在则只更新有值的元数据。
 * 永不写入 customTitle / titleSource(custom)；不因某次返回缺失而清空原字段。
 */
async function upsertItems(
  binding: { id: string; roomId: string; platform: string },
  items: NormalizedItem[],
): Promise<{ added: number; updated: number; failed: number }> {
  let added = 0;
  let updated = 0;
  let failed = 0;
  const seenAt = new Date(); // 本批次的 lastSeenAt：命中即"最近一次出现在刷新结果中"
  for (const it of items) {
    try {
      const aiTitle = !it.title && it.excerpt ? ruleTitle(it.excerpt) : null;
      const existing = await prisma.item.findUnique({
        where: { roomId_externalId: { roomId: binding.roomId, externalId: it.externalId } },
        select: { id: true },
      });
      if (existing) {
        await prisma.item.update({
          where: { id: existing.id },
          data: buildItemUpdateData(binding, it, aiTitle, seenAt),
        });
        updated += 1;
      } else {
        await prisma.item.create({
          data: buildItemCreateData(binding, it, aiTitle, seenAt),
        });
        added += 1;
      }
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[upsert] ${binding.platform} item 写入失败 externalId=${it.externalId}: ${truncate(msg, 120)}`,
      );
    }
  }
  return { added, updated, failed };
}

/** 抓取单条 binding，按窗口过滤后去重写入。 */
export async function refreshBinding(
  bindingId: string,
  window?: RefreshWindow,
): Promise<BindingFetchReport> {
  const binding = await prisma.sourceBinding.findUnique({ where: { id: bindingId } });
  if (!binding) {
    const msg = "binding 不存在";
    return {
      bindingId,
      platform: "?",
      action: "refresh_latest",
      ok: false,
      createdCount: 0,
      updatedCount: 0,
      errorMessage: msg,
      errorCode: classifyError(msg),
    };
  }
  if (!binding.enabled || !fetchablePlatforms().has(binding.platform)) {
    return {
      bindingId,
      platform: binding.platform,
      action: "refresh_latest",
      ok: true,
      createdCount: 0,
      updatedCount: 0,
    };
  }

  const ctx = await authCtxFor(binding.platform, binding.authProfileId);
  const net = ctx.net;
  try {
    const fetched = await fetchForBinding(binding, window, ctx);
    const items = fetched.filter((it) =>
      inWindow(it.publishedAt, window?.since, window?.until),
    );
    const { added, updated, failed } = await upsertItems(binding, items);
    await prisma.sourceBinding.update({
      where: { id: binding.id },
      data: {
        lastFetchedAt: new Date(),
        lastError: writeFailureWarning(failed),
      },
    });
    if (getAdapter(binding.platform)?.checkAuthRequirement() === "browserProfile") {
      await markAuthProfileLoggedIn(binding.platform, ctx.authProfileId, ctx);
    }
    return {
      bindingId,
      platform: binding.platform,
      action: "refresh_latest",
      ok: true,
      createdCount: added,
      updatedCount: updated,
      failedCount: failed || undefined,
      networkLabel: net.humanLabel,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorCode = errorCodeFor(e, msg);
    await prisma.sourceBinding.update({
      where: { id: binding.id },
      data: { lastError: truncate(msg, 300) },
    });
    return {
      bindingId,
      platform: binding.platform,
      action: "refresh_latest",
      ok: false,
      createdCount: 0,
      updatedCount: 0,
      errorMessage: msg,
      errorCode,
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
}): Promise<{ bindings: number; added: number; updated: number; results: BindingFetchReport[] }> {
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
  const results: BindingFetchReport[] = [];
  let added = 0;
  let updated = 0;

  for (const b of bindings) {
    if (!fetchablePlatforms().has(b.platform)) continue;
    const due =
      opts?.force ||
      !b.lastFetchedAt ||
      (now - b.lastFetchedAt.getTime()) / 60_000 >= b.intervalMin;
    if (!due) continue;
    const r = await refreshBinding(b.id, window);
    results.push(r);
    added += r.createdCount ?? 0;
    updated += r.updatedCount ?? 0;
  }
  // 聚合层对外键名（bindings/added/updated）保持不变：RefreshButton 依赖。
  return { bindings: results.length, added, updated, results };
}

/** 回溯的零值信封（早退/失败路径用）：计数全 0，ok=false，由 over 补充细节。 */
function zeroBackfillReport(over: Partial<FetchReport>): FetchReport {
  return {
    ok: false,
    platform: "?",
    action: "backfill",
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    rawCount: 0,
    pageCount: 0,
    hasMore: false,
    shortsCount: 0,
    taggedCount: 0,
    ...over,
  };
}

/** 历史回溯：YouTube（uploads 分页）/ Bilibili（arc/search 分页）/ X（滚动）。同 refresh 的去重/保留语义。 */
export async function backfillBinding(
  bindingId: string,
  limit: number | string,
): Promise<FetchReport> {
  assertDataDir();
  const binding = await prisma.sourceBinding.findUnique({ where: { id: bindingId } });
  if (!binding) {
    const msg = "binding 不存在";
    return zeroBackfillReport({ errorMessage: msg, errorCode: classifyError(msg) });
  }
  const platform = binding.platform;
  const backfillAdapter = getAdapter(platform);
  if (!backfillAdapter?.backfill) {
    const msg = "回溯历史目前支持 YouTube / Bilibili / X source";
    return zeroBackfillReport({ platform, errorMessage: msg, errorCode: classifyError(msg) });
  }
  const sourceInput = binding.feedUrl?.trim() || "";
  if (!sourceInput) {
    const msg = "该 source 缺少频道 / UP 主 / 用户标识";
    return zeroBackfillReport({ platform, errorMessage: msg, errorCode: classifyError(msg) });
  }

  const ctx = await authCtxFor(platform, binding.authProfileId);
  const net = ctx.net;
  try {
    if (platform === "bilibili") {
      const target = clampBackfillLimit(limit, 2000);
      const adapter = getAdapter("bilibili");
      if (!adapter?.backfill) throw new Error("Bilibili adapter 未注册");
      const out = await adapter.backfill(sourceInput, target, {
        profileDir: ctx.profileDir,
        proxyUrl: ctx.proxyUrl,
        useProxy: ctx.useProxy,
      });
      const { added, updated, failed } = await upsertItems(binding, out.items);
      const shortsCount = out.items.filter((v) => v.videoKind === "short").length;
      await prisma.sourceBinding.update({
        where: { id: binding.id },
        data: {
          lastFetchedAt: new Date(),
          lastError: writeFailureWarning(failed),
        },
      });
      return {
        ok: true,
        platform,
        action: "backfill",
        createdCount: added,
        updatedCount: updated,
        failedCount: failed || undefined,
        skippedCount: 0,
        rawCount: out.rawCount ?? 0,
        pageCount: out.pageCount ?? 0,
        hasMore: out.hasMore ?? false,
        shortsCount,
        taggedCount: 0,
        networkLabel: net.humanLabel,
      };
    }

    if (platform === "x") {
      const target = clampBackfillLimit(limit, 600);
      const adapter = getAdapter("x");
      if (!adapter?.backfill) throw new Error("X adapter 未注册");
      const out = await adapter.backfill(sourceInput, target, {
        profileDir: ctx.profileDir,
        proxyUrl: ctx.proxyUrl,
        useProxy: ctx.useProxy,
      });
      const { added, updated, failed } = await upsertItems(binding, out.items);
      await prisma.sourceBinding.update({
        where: { id: binding.id },
        data: {
          lastFetchedAt: new Date(),
          lastError: writeFailureWarning(failed),
        },
      });
      if (adapter.checkAuthRequirement() === "browserProfile") {
        await markAuthProfileLoggedIn(platform, ctx.authProfileId, ctx);
      }
      return {
        ok: true,
        platform,
        action: "backfill",
        createdCount: added,
        updatedCount: updated,
        failedCount: failed || undefined,
        skippedCount: 0,
        rawCount: out.rawCount ?? 0,
        pageCount: out.pageCount ?? 0,
        hasMore: out.hasMore ?? false,
        shortsCount: 0,
        taggedCount: 0,
        networkLabel: net.humanLabel,
      };
    }

    const adapter = getAdapter("youtube");
    if (!adapter?.backfill) throw new Error("YouTube adapter 未注册");
    const out = await adapter.backfill(sourceInput, resolveBackfillLimit(limit), {
      profileDir: ctx.profileDir,
      proxyUrl: ctx.proxyUrl,
      useProxy: ctx.useProxy,
    });
    const { added, updated, failed } = await upsertItems(binding, out.items);
    const skippedCount = Math.max(0, (out.rawCount ?? 0) - out.items.length); // playlist 里有、videos.list 查不到(删/私密)
    const shortsCount = out.items.filter((v) => effectiveVideoKind(v) === "short").length;
    await prisma.sourceBinding.update({
      where: { id: binding.id },
      data: {
        lastFetchedAt: new Date(),
        lastError: writeFailureWarning(failed),
      },
    });
    // 导入后自动同步一次播放列表标签（best-effort；syncPlaylistTagsForBinding 会自行更新 binding 状态）
    let playlistTaggedCount = 0;
    try {
      const sync = await syncPlaylistTagsForBinding(binding.id);
      playlistTaggedCount = sync.taggedCount ?? 0;
    } catch {
      // 标签同步失败不影响 backfill 主结果
    }
    const warning = writeFailureWarning(failed);
    if (warning) {
      await prisma.sourceBinding.update({
        where: { id: binding.id },
        data: { lastError: warning },
      });
    }
    return {
      ok: true,
      platform,
      action: "backfill",
      createdCount: added,
      updatedCount: updated,
      failedCount: failed || undefined,
      skippedCount,
      rawCount: out.rawCount ?? 0,
      pageCount: out.pageCount ?? 0,
      hasMore: out.hasMore ?? false,
      shortsCount,
      taggedCount: playlistTaggedCount,
      networkLabel: net.humanLabel,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorCode = errorCodeFor(e, msg);
    await prisma.sourceBinding.update({
      where: { id: binding.id },
      data: { lastError: truncate(msg, 300) },
    });
    return zeroBackfillReport({
      platform,
      errorMessage: msg,
      errorCode,
      networkLabel: net.humanLabel,
      hint: networkHint(net.region, msg),
    });
  }
}

/** 标签同步的零值信封（早退/失败路径用）。 */
function zeroSyncTagsReport(over: Partial<FetchReport>): FetchReport {
  return {
    ok: false,
    platform: "youtube",
    action: "sync_tags",
    taggedCount: 0,
    playlistCount: 0,
    ...over,
  };
}

/**
 * 同步该 YouTube source 的播放列表标签：
 * 读取频道公开播放列表 → 只给"本 source 已导入的视频"打标签（非本频道上传的不导入、不打标）。
 * 不创建任何 item；不影响视频卡片是否存在；customTitle / youtubeKind 不受影响。
 */
export async function syncPlaylistTagsForBinding(
  bindingId: string,
): Promise<FetchReport> {
  const binding = await prisma.sourceBinding.findUnique({ where: { id: bindingId } });
  if (!binding) {
    const msg = "binding 不存在";
    return zeroSyncTagsReport({ platform: "?", errorMessage: msg, errorCode: classifyError(msg) });
  }
  if (binding.platform !== "youtube") {
    const msg = "同步播放列表标签仅支持 YouTube source";
    return zeroSyncTagsReport({
      platform: binding.platform,
      errorMessage: msg,
      errorCode: classifyError(msg),
    });
  }
  const sourceInput = binding.feedUrl?.trim() || "";
  if (!sourceInput) {
    const msg = "该 source 缺少频道 ID / @handle / 链接";
    return zeroSyncTagsReport({ errorMessage: msg, errorCode: classifyError(msg) });
  }

  const net = resolveRefreshNetwork({ platform: binding.platform });
  try {
    const adapter = getAdapter("youtube");
    if (!adapter?.syncTags) throw new Error("YouTube adapter 未注册");
    const { tagMap, playlistCount } = await adapter.syncTags(sourceInput, {
      proxyUrl: net.shouldUseProxy ? net.proxyUrl : undefined,
      useProxy: net.shouldUseProxy,
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
    return {
      ok: true,
      platform: "youtube",
      action: "sync_tags",
      taggedCount,
      playlistCount,
      networkLabel: net.humanLabel,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errorCode = errorCodeFor(e, msg);
    await prisma.sourceBinding.update({
      where: { id: binding.id },
      data: { lastError: truncate(msg, 300) },
    });
    return zeroSyncTagsReport({
      errorMessage: msg,
      errorCode,
      networkLabel: net.humanLabel,
      hint: networkHint(net.region, msg),
    });
  }
}
