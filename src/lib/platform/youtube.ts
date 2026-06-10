import { extractChannelId, extractHandle } from "../connectors/youtube.ts";
import type { PlatformAdapter, SourceCapabilities } from "./types.ts";

const CAPABILITIES: SourceCapabilities = {
  latestRefresh: true,
  backfill: true,
  tagsSync: true,
  authRequired: false,
  authOptional: false,
  mediaSupport: false,
  debugSupport: false,
  commentsSupported: false,
  downloadsSupported: false,
  writesSupported: false,
};

export const youtubeAdapter: PlatformAdapter = {
  platform: "youtube",

  getCapabilities() {
    return CAPABILITIES;
  },

  checkAuthRequirement() {
    return "apiKeyOptional";
  },

  resolveSourceInput(raw: string) {
    const channelId = extractChannelId(raw);
    if (channelId) return channelId;
    const handle = extractHandle(raw);
    return handle ? `@${handle}` : null;
  },

  async refreshLatest(rawInput, ctx) {
    if (!rawInput.trim()) {
      throw new Error("YouTube 绑定需要频道 ID（UC… 开头）或 feed URL");
    }
    // API key is YouTube-private config; ExecCtx only carries cross-platform runtime
    // environment. Never log process.env.YOUTUBE_API_KEY.
    const { fetchYouTube } = await import("../connectors/index");
    return {
      items: await fetchYouTube(rawInput, process.env.YOUTUBE_API_KEY, ctx.proxyUrl),
    };
  },

  async backfill(rawInput, limit, ctx) {
    const { backfillYouTubeChannel } = await import("../connectors/index");
    const { videos, fetchedCount, pageCount, hasMore } = await backfillYouTubeChannel({
      sourceInput: rawInput,
      apiKey: process.env.YOUTUBE_API_KEY,
      limit,
      proxyUrl: ctx.proxyUrl,
    });
    return { items: videos, rawCount: fetchedCount, pageCount, hasMore };
  },

  async syncTags(rawInput, ctx) {
    const { fetchChannelPlaylistTags } = await import("../connectors/index");
    return fetchChannelPlaylistTags({
      sourceInput: rawInput,
      apiKey: process.env.YOUTUBE_API_KEY,
      proxyUrl: ctx.proxyUrl,
    });
  },
};
