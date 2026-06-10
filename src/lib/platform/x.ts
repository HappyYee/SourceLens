import { parseXInput } from "../connectors/xpost.ts";
import type { PlatformAdapter, SourceCapabilities } from "./types.ts";

const CAPABILITIES: SourceCapabilities = {
  latestRefresh: true,
  backfill: true,
  tagsSync: false,
  authRequired: true,
  authOptional: false,
  mediaSupport: true,
  debugSupport: false,
  commentsSupported: false,
  downloadsSupported: false,
  writesSupported: false,
};

function resolveHandle(rawInput: string): string {
  const handle = parseXInput(rawInput);
  if (!handle) throw new Error("无法解析 X 用户名：请填 @handle 或 x.com/{handle} 链接");
  return handle;
}

function requireProfileDir(profileDir?: string): string {
  if (!profileDir) {
    throw new Error("需要 X 登录态：请先在设置页创建 x 登录态并登录后重试");
  }
  return profileDir;
}

export const xAdapter: PlatformAdapter = {
  platform: "x",

  getCapabilities() {
    return CAPABILITIES;
  },

  checkAuthRequirement() {
    return "browserProfile";
  },

  resolveSourceInput(raw: string) {
    return parseXInput(raw);
  },

  async refreshLatest(rawInput, ctx) {
    const handle = resolveHandle(rawInput);
    const profileDir = requireProfileDir(ctx.profileDir);
    const { scrapeXUser } = await import("../connectors/x-scrape");
    const { videos, scannedCount } = await scrapeXUser({
      handle,
      profileDir,
      proxyUrl: ctx.proxyUrl,
      targetCount: 40,
    });
    return { items: videos, rawCount: scannedCount };
  },

  async backfill(rawInput, limit, ctx) {
    const handle = resolveHandle(rawInput);
    const profileDir = requireProfileDir(ctx.profileDir);
    const { scrapeXUser } = await import("../connectors/x-scrape");
    const { videos, scannedCount } = await scrapeXUser({
      handle,
      profileDir,
      proxyUrl: ctx.proxyUrl,
      targetCount: limit,
    });
    return {
      items: videos,
      rawCount: scannedCount,
      pageCount: 0,
      hasMore: videos.length >= limit,
    };
  },
};
