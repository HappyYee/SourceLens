// 统一的"国内刷新 / 国外刷新"网络通道解析 + 刷新结果文案。纯逻辑，可测；
// 代理逻辑集中在此，不散落到各 connector。
// 显式 .ts 后缀：让本模块在 node --test（原生 ESM）下也能直接 import 运行。
import { pickProxyUrl } from "./proxy-url.ts";
import { NETWORK_ERR } from "./report.ts";
import type { FetchReport } from "./report.ts";

export type RefreshRegion = "domestic" | "foreign" | "auto";
export type ProxyMode = "none" | "system" | "manual";

const FOREIGN_PLATFORMS = new Set(["x", "twitter", "youtube"]);
const DOMESTIC_PLATFORMS = new Set(["bilibili"]);
const DEFAULT_FOREIGN_PROXY = "http://127.0.0.1:33210";

export interface RefreshNetwork {
  region: "domestic" | "foreign";
  shouldUseProxy: boolean;
  proxyUrl?: string;
  humanLabel: "国内刷新" | "国外刷新";
  warning?: string;
}

/** auto 时按平台判定：bilibili→domestic，x/youtube→foreign，其它默认 foreign。 */
export function resolveRegion(platform: string, region?: RefreshRegion): "domestic" | "foreign" {
  if (region === "domestic" || region === "foreign") return region;
  if (DOMESTIC_PLATFORMS.has(platform)) return "domestic";
  if (FOREIGN_PLATFORMS.has(platform)) return "foreign";
  return "foreign";
}

export function resolveRefreshNetwork(opts: {
  platform: string;
  refreshRegion?: RefreshRegion;
  proxyMode?: ProxyMode;
  proxyUrl?: string | null;
  env?: Record<string, string | undefined>;
}): RefreshNetwork {
  const env = opts.env ?? process.env;
  const region = resolveRegion(opts.platform, opts.refreshRegion);
  const humanLabel = region === "domestic" ? "国内刷新" : "国外刷新";

  // 手动代理优先于一切
  const manualUrl = opts.proxyMode === "manual" ? (opts.proxyUrl ?? "").trim() : "";
  if (manualUrl) {
    return { region, shouldUseProxy: true, proxyUrl: manualUrl, humanLabel };
  }
  if (opts.proxyMode === "none") {
    return { region, shouldUseProxy: false, humanLabel };
  }
  if (region === "foreign") {
    const envProxy = pickProxyUrl(env);
    return {
      region,
      shouldUseProxy: true,
      proxyUrl: envProxy ?? DEFAULT_FOREIGN_PROXY,
      humanLabel,
      warning: envProxy
        ? undefined
        : "未检测到 HTTPS_PROXY，将用默认 http://127.0.0.1:33210",
    };
  }
  // domestic 默认直连
  return { region, shouldUseProxy: false, humanLabel };
}

export type RefreshAction =
  | "check_auth"
  | "refresh_latest"
  | "backfill"
  | "sync_tags"
  | "check_availability";

/** 由区域 + 错误信息生成网络相关提示（仅网络类错误才提示）。 */
export function networkHint(
  region: "domestic" | "foreign",
  error?: string,
): string | undefined {
  if (!error || !NETWORK_ERR.test(error)) return undefined;
  return region === "foreign"
    ? "国外刷新失败：请确认是否在导出 HTTPS_PROXY / HTTP_PROXY 的同一 shell 中启动 dev，或检查代理是否开启。"
    : "国内刷新失败：请检查本机网络或目标平台是否可访问。";
}

/** 行内展示文案（成功 / 失败）。 */
export function formatOutcome(o: FetchReport): string {
  if (o.action === "check_auth") {
    return o.ok
      ? `${o.networkLabel} · 已登录`
      : `${o.networkLabel} · ${o.errorMessage || "未确认登录"}${o.hint ? `。${o.hint}` : ""}`;
  }
  if (!o.ok) {
    return `${o.networkLabel}失败：${o.errorMessage || "未知错误"}${o.hint ? `。${o.hint}` : ""}`;
  }
  const hasCounts =
    o.createdCount != null || o.updatedCount != null || o.rawCount != null;
  const created = o.createdCount ?? 0;
  const updated = o.updatedCount ?? 0;
  const scanned = o.rawCount ?? 0;
  if (hasCounts && created === 0 && updated === 0 && scanned === 0) {
    return `${o.networkLabel}成功：没有新内容`;
  }
  const parts: string[] = [];
  if (o.createdCount != null) parts.push(`+${created} 新`);
  if (o.updatedCount != null) parts.push(`${updated} 更`);
  if (o.skippedCount) parts.push(`跳过 ${o.skippedCount}`);
  if (o.rawCount != null) parts.push(`已扫描 ${scanned}`);
  return parts.length ? `${o.networkLabel}成功：${parts.join(" · ")}` : `${o.networkLabel}成功`;
}
