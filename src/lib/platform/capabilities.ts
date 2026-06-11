import type { AuthRequirement, SourceCapabilities } from "./types.ts";

// Client-safe platform knowledge leaf.
// Keep this module as pure static data: do not import runtime platform modules,
// connector modules, or the server registry here. Even dynamic imports are still
// statically analyzed into client chunks by webpack; this rule was added after
// F4a accidentally pulled playwright-core into the browser bundle.

const FEED_CAPABILITIES: SourceCapabilities = {
  latestRefresh: true,
  backfill: false,
  backfillAll: false,
  tagsSync: false,
  availabilityCheck: false,
  authRequired: false,
  authOptional: false,
  mediaSupport: false,
  debugSupport: false,
  commentsSupported: false,
  downloadsSupported: false,
  writesSupported: false,
};

export const PLATFORM_CAPABILITIES: Readonly<Record<string, SourceCapabilities>> = {
  arxiv: FEED_CAPABILITIES,
  bilibili: {
    latestRefresh: true,
    backfill: true,
    backfillAll: true,
    tagsSync: false,
    availabilityCheck: false,
    authRequired: false,
    authOptional: true,
    mediaSupport: false,
    debugSupport: false,
    commentsSupported: false,
    downloadsSupported: false,
    writesSupported: false,
  },
  github: FEED_CAPABILITIES,
  podcast: FEED_CAPABILITIES,
  rss: FEED_CAPABILITIES,
  x: {
    latestRefresh: true,
    backfill: true,
    backfillAll: false,
    tagsSync: false,
    availabilityCheck: false,
    authRequired: true,
    authOptional: false,
    mediaSupport: true,
    debugSupport: false,
    commentsSupported: false,
    downloadsSupported: false,
    writesSupported: false,
  },
  youtube: {
    latestRefresh: true,
    backfill: true,
    backfillAll: true,
    tagsSync: true,
    availabilityCheck: true, // videos.list 缺席 = 已删/转私密（确定性证据）
    authRequired: false,
    authOptional: false,
    mediaSupport: false,
    debugSupport: false,
    commentsSupported: false,
    downloadsSupported: false,
    writesSupported: false,
  },
};

export const PLATFORM_AUTH: Readonly<Record<string, AuthRequirement>> = {
  arxiv: "none",
  // Bilibili profile is an optional fallback, not required auth. Keeping this as
  // "none" prevents public fetch success from marking a Bilibili profile logged in.
  bilibili: "none",
  github: "none",
  podcast: "none",
  rss: "none",
  x: "browserProfile",
  youtube: "apiKeyOptional",
};

export function capabilitiesFor(platform: string): SourceCapabilities | undefined {
  return PLATFORM_CAPABILITIES[platform];
}
