// Source 行内结果文案（纯函数，client-safe）。输出字符串与 SourceItem 历史内联版逐字一致；
// 入参为 FetchReport 形状的宽松子集（字段可缺省，兼容 fetch 失败时的空对象兜底）。
interface RefreshLatestResultLike {
  networkLabel?: string;
  createdCount?: number;
  updatedCount?: number;
  errorMessage?: string;
  hint?: string;
}

interface BackfillResultLike {
  networkLabel?: string;
  createdCount?: number;
  updatedCount?: number;
  rawCount?: number;
  shortsCount?: number;
  skippedCount?: number;
  taggedCount?: number;
  hasMore?: boolean;
  errorMessage?: string;
  hint?: string;
}

interface AvailabilityResultLike {
  networkLabel?: string;
  checkedCount?: number;
  missingCount?: number;
  errorMessage?: string;
  hint?: string;
}

interface SyncTagsResultLike {
  networkLabel?: string;
  playlistCount?: number;
  taggedCount?: number;
  errorMessage?: string;
  hint?: string;
}

function resultTag(j: { networkLabel?: string }): string {
  return j.networkLabel ? `${j.networkLabel} · ` : "";
}

export function formatRefreshLatestResult(ok: boolean, j: RefreshLatestResultLike): string {
  const tag = resultTag(j);
  return ok
    ? `${tag}最新：+${j.createdCount ?? 0} 新 · ${j.updatedCount ?? 0} 更`
    : `${tag}${j.errorMessage || "刷新失败"}${j.hint ? "。" + j.hint : ""}`;
}

export function formatBackfillResult(ok: boolean, j: BackfillResultLike): string {
  const tag = resultTag(j);
  if (!ok) {
    return `${tag}${j.errorMessage || "回溯失败"}${j.hint ? "。" + j.hint : ""}`;
  }
  return (
    `${tag}回溯：+${j.createdCount} 新 · ${j.updatedCount} 更 · 已扫描 ${j.rawCount}` +
    (j.shortsCount ? ` · Shorts ${j.shortsCount}` : "") +
    (j.skippedCount ? ` · 跳过 ${j.skippedCount}` : "") +
    (j.taggedCount ? ` · 打标 ${j.taggedCount}` : "") +
    (j.hasMore ? " · 还有更多" : "")
  );
}

export function formatSyncTagsResult(ok: boolean, j: SyncTagsResultLike): string {
  const tag = resultTag(j);
  return ok
    ? `${tag}播放列表：${j.playlistCount} 个 · 打标 ${j.taggedCount} 条`
    : `${tag}${j.errorMessage || "同步失败"}${j.hint ? "。" + j.hint : ""}`;
}

export function formatAvailabilityResult(ok: boolean, j: AvailabilityResultLike): string {
  const tag = resultTag(j);
  if (!ok) {
    return `${tag}${j.errorMessage || "检查失败"}${j.hint ? "。" + j.hint : ""}`;
  }
  const checked = j.checkedCount ?? 0;
  const missing = j.missingCount ?? 0;
  return missing > 0
    ? `${tag}可用性：已检查 ${checked} 条 · ${missing} 条源头已下架`
    : `${tag}可用性：已检查 ${checked} 条 · 全部可用`;
}
