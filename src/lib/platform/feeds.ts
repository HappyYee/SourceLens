import { buildArxivUrl } from "../connectors/arxiv.ts";
import { buildGithubUrl } from "../connectors/github.ts";
import { PLATFORM_AUTH, PLATFORM_CAPABILITIES } from "./capabilities.ts";
import type { ExecCtx, PlatformAdapter } from "./types.ts";

function feedInputError(): Error {
  return new Error("无法解析 feed URL（检查 feedUrl / query）");
}

function makeFeedAdapter(
  platform: string,
  opts: { buildUrl: (raw: string) => string | null; isPodcast?: boolean },
): PlatformAdapter {
  return {
    platform,

    getCapabilities() {
      return PLATFORM_CAPABILITIES[platform];
    },

    checkAuthRequirement() {
      return PLATFORM_AUTH[platform];
    },

    resolveSourceInput(raw: string) {
      return raw.trim() || null;
    },

    async refreshLatest(rawInput) {
      const url = opts.buildUrl(rawInput);
      if (!url) throw feedInputError();
      const { fetchFeed } = await import("../connectors/index");
      return { items: await fetchFeed(url, opts.isPodcast ?? false) };
    },
  };
}

export const rssAdapter = makeFeedAdapter("rss", {
  buildUrl: (s) => s.trim() || null,
});

export const podcastAdapter = makeFeedAdapter("podcast", {
  buildUrl: (s) => s.trim() || null,
  isPodcast: true,
});

export const githubAdapter = makeFeedAdapter("github", {
  buildUrl: (s) => (s.trim() ? buildGithubUrl(s) : null),
});

const baseArxivAdapter = makeFeedAdapter("arxiv", {
  buildUrl: (s) => (s.trim() ? buildArxivUrl(s) : null),
});

export const arxivAdapter: PlatformAdapter = {
  ...baseArxivAdapter,

  async refreshLatest(rawInput: string, ctx: ExecCtx) {
    const query = rawInput.trim();
    if (!query) throw feedInputError();
    if (ctx.window?.deep) {
      const { fetchArxivPaged } = await import("../connectors/index");
      return { items: await fetchArxivPaged(query, ctx.window.since) };
    }
    const { fetchFeed } = await import("../connectors/index");
    return { items: await fetchFeed(buildArxivUrl(query)) };
  },
};
