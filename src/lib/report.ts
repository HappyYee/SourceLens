import type { BrowserErrorCode } from "./browser.ts";
import type { RefreshAction } from "./network.ts";

export type ErrorCode =
  | "network"
  | "auth_expired"
  | "profile_busy"
  | "environment"
  | "input"
  | "quota"
  | "rate_limited"
  | "not_found"
  | "parse"
  | "unknown";

export const NETWORK_ERR = /超时|timeout|aborted|econn|fetch failed|网络错误|enotfound|socket|代理|proxy/i;

export function isNetworkError(msg: string): boolean {
  return NETWORK_ERR.test(msg);
}

const ENVIRONMENT_BROWSER_CODES = new Set<BrowserErrorCode>([
  "playwright_import",
  "chrome_missing",
  "profile_dir",
  "launch",
  "navigate",
]);

const PROFILE_BUSY_RE = /SingletonLock|ProcessSingleton|in use|already running|cannot create/i;

export function classifyError(message: string, browserCode?: string): ErrorCode {
  // Classification order is intentional: specific browser/runtime states win
  // before broad text patterns such as "找不到".
  if (browserCode === "profile_busy") return "profile_busy";
  if (ENVIRONMENT_BROWSER_CODES.has(browserCode as BrowserErrorCode)) return "environment";
  if (PROFILE_BUSY_RE.test(message)) return "profile_busy";
  if (/playwright|本机 Chrome|profile 目录不可写|启动浏览器失败/i.test(message)) return "environment";
  if (isNetworkError(message)) return "network";
  if (/配额|quota/i.test(message)) return "quota";
  if (/登录已失效|登录态失效|未登录|需要 X 登录态|重新打开登录窗口/i.test(message)) {
    return "auth_expired";
  }
  if (/无法解析|请填|缺少 YOUTUBE_API_KEY|绑定需要频道 ID/i.test(message)) return "input";
  if (/找不到频道|找不到/i.test(message)) return "not_found";
  // rate_limited / parse are reserved for future structured connector reports.
  return "unknown";
}

export interface FetchReport {
  ok: boolean;
  platform: string;
  action: RefreshAction;
  networkLabel?: string;
  refreshRegion?: string;
  stage?: string;
  executor?: string;
  rawCount?: number;
  createdCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  failedCount?: number;
  pageCount?: number;
  hasMore?: boolean;
  // 平台展示计数（Phase 3 字段收敛时再评估归并）。
  shortsCount?: number;
  taggedCount?: number;
  playlistCount?: number;
  errorCode?: ErrorCode;
  errorMessage?: string;
  hint?: string;
}

// FetchReport 是平台层唯一的结果信封（F4b 起取代 RefreshResult / BackfillCounts /
// PlaylistSyncResult / RefreshOutcome）。字段映射约定：legacy added/updated →
// createdCount/updatedCount；error → errorMessage；fetchedCount/scannedCount →
// rawCount；BackfillCounts.playlistTaggedCount 与 PlaylistSyncResult.taggedCount
// 统一为 taggedCount。
