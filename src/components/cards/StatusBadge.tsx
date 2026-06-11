import type { ItemVM } from "@/lib/types";

/** 档案可用性徽章：仅 unavailable 显示（available/null 零噪音）。 */
export function StatusBadge({ it }: { it: ItemVM }) {
  if ((it.availability ?? "unknown") !== "unavailable") return null;
  const since = it.missingSince ? new Date(it.missingSince).toLocaleDateString() : null;
  return (
    <span className="it-status unavailable" title={since ? `首次发现于 ${since}` : undefined}>
      源头已下架
    </span>
  );
}
