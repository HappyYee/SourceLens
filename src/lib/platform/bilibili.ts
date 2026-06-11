import { parseBilibiliInput } from "../connectors/bilibili.ts";
import { PLATFORM_AUTH, PLATFORM_CAPABILITIES } from "./capabilities.ts";
import type { PlatformAdapter } from "./types.ts";

function resolveMid(rawInput: string): string {
  const mid = parseBilibiliInput(rawInput);
  if (!mid) throw new Error("无法解析 B 站 UP 主：请填 mid 或 space.bilibili.com/{mid} 链接");
  return mid;
}

export const bilibiliAdapter: PlatformAdapter = {
  platform: "bilibili",

  getCapabilities() {
    return PLATFORM_CAPABILITIES.bilibili;
  },

  checkAuthRequirement() {
    return PLATFORM_AUTH.bilibili;
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
