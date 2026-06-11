import type { NormalizedItem } from "../normalize.ts";

export type AuthRequirement = "none" | "apiKeyOptional" | "browserProfile";

export interface SourceCapabilities {
  latestRefresh: true;
  backfill: boolean;
  /** Whether the UI may offer an "all history" backfill option. */
  backfillAll: boolean;
  tagsSync: boolean;
  authRequired: boolean;
  authOptional: boolean;
  mediaSupport: boolean;
  debugSupport: boolean;
  commentsSupported: false;
  downloadsSupported: false;
  writesSupported: false;
}

export interface ExecCtx {
  profileDir?: string;
  proxyUrl?: string;
  useProxy: boolean;
  /** Fetch-efficiency hints only; final time-window filtering stays in the orchestrator. */
  window?: { since?: Date; deep?: boolean };
}

export interface FetchOutput {
  items: NormalizedItem[];
  rawCount?: number;
  pageCount?: number;
  hasMore?: boolean;
}

export interface PlatformAdapter {
  platform: string;
  getCapabilities(): SourceCapabilities;
  checkAuthRequirement(): AuthRequirement;
  resolveSourceInput(raw: string): string | null;
  refreshLatest(rawInput: string, ctx: ExecCtx): Promise<FetchOutput>;
  backfill?(rawInput: string, limit: number, ctx: ExecCtx): Promise<FetchOutput>;
  syncTags?(
    rawInput: string,
    ctx: ExecCtx,
  ): Promise<{ tagMap: Map<string, string[]>; playlistCount: number }>;
}
