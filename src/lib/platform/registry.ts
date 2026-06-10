import type { PlatformAdapter } from "./types.ts";
import { bilibiliAdapter } from "./bilibili.ts";
import { arxivAdapter, githubAdapter, podcastAdapter, rssAdapter } from "./feeds.ts";
import { xAdapter } from "./x.ts";
import { youtubeAdapter } from "./youtube.ts";

const ADAPTERS: Record<string, PlatformAdapter> = {
  arxiv: arxivAdapter,
  bilibili: bilibiliAdapter,
  github: githubAdapter,
  podcast: podcastAdapter,
  rss: rssAdapter,
  x: xAdapter,
  youtube: youtubeAdapter,
};

const FETCHABLE_PLATFORMS: ReadonlySet<string> = new Set(Object.keys(ADAPTERS));

export function getAdapter(platform: string): PlatformAdapter | undefined {
  return ADAPTERS[platform];
}

export function fetchablePlatforms(): ReadonlySet<string> {
  return FETCHABLE_PLATFORMS;
}
