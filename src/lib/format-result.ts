interface RefreshLatestResultLike {
  networkLabel?: string;
  added?: number;
  updated?: number;
  error?: string;
  hint?: string;
}

interface BackfillResultLike {
  networkLabel?: string;
  createdCount?: number;
  updatedCount?: number;
  fetchedCount?: number;
  shortsCount?: number;
  skippedCount?: number;
  playlistTaggedCount?: number;
  hasMore?: boolean;
  error?: string;
  hint?: string;
}

interface SyncTagsResultLike {
  networkLabel?: string;
  playlistCount?: number;
  taggedCount?: number;
  error?: string;
  hint?: string;
}

function resultTag(j: { networkLabel?: string }): string {
  return j.networkLabel ? `${j.networkLabel} · ` : "";
}

export function formatRefreshLatestResult(ok: boolean, j: RefreshLatestResultLike): string {
  const tag = resultTag(j);
  return ok
    ? `${tag}最新：+${j.added ?? 0} 新 · ${j.updated ?? 0} 更`
    : `${tag}${j.error || "刷新失败"}${j.hint ? "。" + j.hint : ""}`;
}

export function formatBackfillResult(ok: boolean, j: BackfillResultLike): string {
  const tag = resultTag(j);
  if (!ok) {
    return `${tag}${j.error || "回溯失败"}${j.hint ? "。" + j.hint : ""}`;
  }
  return (
    `${tag}回溯：+${j.createdCount} 新 · ${j.updatedCount} 更 · 已扫描 ${j.fetchedCount}` +
    (j.shortsCount ? ` · Shorts ${j.shortsCount}` : "") +
    (j.skippedCount ? ` · 跳过 ${j.skippedCount}` : "") +
    (j.playlistTaggedCount ? ` · 打标 ${j.playlistTaggedCount}` : "") +
    (j.hasMore ? " · 还有更多" : "")
  );
}

export function formatSyncTagsResult(ok: boolean, j: SyncTagsResultLike): string {
  const tag = resultTag(j);
  return ok
    ? `${tag}播放列表：${j.playlistCount} 个 · 打标 ${j.taggedCount} 条`
    : `${tag}${j.error || "同步失败"}${j.hint ? "。" + j.hint : ""}`;
}
