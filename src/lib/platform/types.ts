import type { NormalizedItem } from "../normalize.ts";

export type AuthRequirement = "none" | "apiKeyOptional" | "browserProfile";

export interface SourceCapabilities {
  latestRefresh: true;
  backfill: boolean;
  /** Whether the UI may offer an "all history" backfill option. */
  backfillAll: boolean;
  tagsSync: boolean;
  /** 是否支持可用性检查（availability，Phase 3b；证据必须是平台确定性信号）。 */
  availabilityCheck: boolean;
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
  /** 可用性检查：返回平台确认仍存在 / 确认缺失的 externalId 集合。 */
  checkAvailability?(
    externalIds: string[],
    ctx: ExecCtx,
  ): Promise<{ found: Set<string>; missing: Set<string> }>;
}
