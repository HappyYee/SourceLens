// 刷新时间窗解析（纯函数，可被 node --test 直跑）。
// 窗口语义 = 导入过滤器：只导入发布时间落在窗内的条目；不带窗口（检查更新）导入最新批次全部。
export type RefreshScope = "today" | "week" | "range" | "all" | undefined;

export interface ScopeWindow {
  since?: Date;
  until?: Date;
  deep: boolean; // 是否向更早翻页（当前仅 arXiv 实现）
}

export function scopeWindow(
  scope: RefreshScope,
  now: Date,
  sinceStr?: string,
  untilStr?: string,
): ScopeWindow {
  if (scope === "today") {
    const since = new Date(now);
    since.setHours(0, 0, 0, 0);
    return { since, until: new Date(now), deep: false };
  }
  if (scope === "week") {
    // 滚动 7 天（而非自然周）：覆盖"离开一周回来补齐"的直觉
    return { since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), until: new Date(now), deep: false };
  }
  if (scope === "all") {
    return { until: new Date(now), deep: true };
  }
  if (scope === "range") {
    let since = sinceStr ? new Date(sinceStr) : undefined;
    let until = untilStr ? new Date(untilStr) : undefined;
    if (since && Number.isNaN(+since)) since = undefined;
    if (until && Number.isNaN(+until)) until = undefined;
    return { since, until, deep: true };
  }
  return { deep: false };
}

/** 校验 body.scope：仅接受已知值，其余视为未指定。 */
export function parseScope(v: unknown): RefreshScope {
  return v === "today" || v === "week" || v === "range" || v === "all" ? v : undefined;
}
