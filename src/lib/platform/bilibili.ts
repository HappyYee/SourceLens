import { parseBilibiliInput } from "../connectors/bilibili.ts";
import type { PlatformAdapter, SourceCapabilities } from "./types.ts";

const CAPABILITIES: SourceCapabilities = {
  latestRefresh: true,
  backfill: true,
  tagsSync: false,
  authRequired: false,
  authOptional: true,
  mediaSupport: false,
  debugSupport: false,
  commentsSupported: false,
  downloadsSupported: false,
  writesSupported: false,
};

function resolveMid(rawInput: string): string {
  const mid = parseBilibiliInput(rawInput);
  if (!mid) throw new Error("无法解析 B 站 UP 主：请填 mid 或 space.bilibili.com/{mid} 链接");
  return mid;
}

export const bilibiliAdapter: PlatformAdapter = {
  platform: "bilibili",

  getCapabilities() {
    return CAPABILITIES;
  },

  checkAuthRequirement() {
    // Bilibili profile is an optional fallback, not required auth. Keeping this as
    // "none" prevents public fetch success from marking a Bilibili profile logged in.
    return "none";
  },

  resolveSourceInput(raw: string) {
    return parseBilibiliInput(raw);
  },

  async refreshLatest(rawInput, ctx) {
    const mid = resolveMid(rawInput);
    const { collectBilibiliArchives } = await import("../connectors/bilibili-net");
    const { videos, fetchedCount, pageCount, hasMore } = await collectBilibiliArchives({
      mid,
      limit: 50,
      channel: { useProxy: ctx.useProxy, proxyUrl: ctx.proxyUrl, profileDir: ctx.profileDir },
    });
    return { items: videos, rawCount: fetchedCount, pageCount, hasMore };
  },

  async backfill(rawInput, limit, ctx) {
    const mid = resolveMid(rawInput);
    const { collectBilibiliArchives } = await import("../connectors/bilibili-net");
    const { videos, fetchedCount, pageCount, hasMore } = await collectBilibiliArchives({
      mid,
      limit,
      channel: { useProxy: ctx.useProxy, proxyUrl: ctx.proxyUrl, profileDir: ctx.profileDir },
    });
    return { items: videos, rawCount: fetchedCount, pageCount, hasMore };
  },
};
