// 可用性检查的纯分拣逻辑（Phase 3b）。可被 node --test 直跑。
// 语义铁律：availability 只接受平台确定性证据；found 可自愈（清 missingSince），
// missing 保留首见时间；不在 found/missing 任何一边的条目不产生更新（未评估）。

export interface AvailabilityItemRow {
  id: string;
  externalId: string;
  missingSince: Date | null;
}

export interface AvailabilityUpdate {
  id: string;
  availability: "available" | "unavailable";
  lastCheckedAt: Date;
  missingSince: Date | null;
}

export function buildAvailabilityUpdates(
  items: AvailabilityItemRow[],
  found: Set<string>,
  missing: Set<string>,
  now: Date,
): AvailabilityUpdate[] {
  const out: AvailabilityUpdate[] = [];
  for (const it of items) {
    if (found.has(it.externalId)) {
      out.push({
        id: it.id,
        availability: "available",
        lastCheckedAt: now,
        missingSince: null, // 曾被误判/恢复可见 → 自愈
      });
    } else if (missing.has(it.externalId)) {
      out.push({
        id: it.id,
        availability: "unavailable",
        lastCheckedAt: now,
        missingSince: it.missingSince ?? now, // 首见时间只记一次
      });
    }
    // 两边都不在：本次未评估，跳过（绝不默认 unavailable）。
  }
  return out;
}
