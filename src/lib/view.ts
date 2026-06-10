// 纯函数视图逻辑：排序、按天分组、相对时间、时长格式化。
// 不依赖任何外部包，可被 Next 组件与 node --test 直接使用（spec 验收的核心逻辑在此）。

import type { ItemVM, RoomVM } from "./types";

export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 距今天的整天偏移：今天=0、昨天=1、N 天前=N。 */
export function dayOffset(publishedAt: string | Date, now: Date): number {
  const p = startOfDay(new Date(publishedAt)).getTime();
  const n = startOfDay(now).getTime();
  return Math.round((n - p) / 86_400_000);
}

/** 秒 → 显示时长：有小时 h:mm:ss，否则 mm:ss。无效返回 null。 */
export function formatDuration(sec?: number | null): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const total = Math.floor(sec);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 相对时间（中文）：刚刚 / N 分钟前 / N 小时前 / 今天 HH:MM / 昨天 HH:MM / N 天前 / M 月 D 日。 */
export function formatRelativeTime(publishedAt: string | Date, now: Date): string {
  const p = new Date(publishedAt);
  const diffMs = now.getTime() - p.getTime();
  const off = dayOffset(p, now);
  if (off <= 0) {
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return "刚刚";
    if (min < 60) return `${min} 分钟前`;
    const hr = Math.floor(min / 60);
    if (hr < 6) return `${hr} 小时前`;
    return `今天 ${pad(p.getHours())}:${pad(p.getMinutes())}`;
  }
  if (off === 1) return `昨天 ${pad(p.getHours())}:${pad(p.getMinutes())}`;
  if (off < 7) return `${off} 天前`;
  return `${p.getMonth() + 1} 月 ${p.getDate()} 日`;
}

/** 时间线按 publishedAt 降序。 */
export function sortItemsDesc(items: ItemVM[]): ItemVM[] {
  return [...items].sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt),
  );
}

export interface DayGroup {
  off: number;
  label: string;
  items: ItemVM[];
}

/** 按自然天分组，今天在前。组内按时间降序。 */
export function groupByDay(items: ItemVM[], now: Date): DayGroup[] {
  const map = new Map<number, ItemVM[]>();
  for (const it of items) {
    const off = dayOffset(it.publishedAt, now);
    const arr = map.get(off);
    if (arr) arr.push(it);
    else map.set(off, [it]);
  }
  const offs = [...map.keys()].sort((a, b) => a - b); // 0(今天) → 越来越早
  return offs.map((off) => {
    const items = sortItemsDesc(map.get(off)!);
    let label: string;
    if (off <= 0) label = "今天";
    else if (off === 1) label = "昨天";
    else if (off < 7) label = `${off} 天前`;
    else {
      const d = new Date(items[0].publishedAt);
      label = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    }
    return { off, label, items };
  });
}

/** 今日轨迹(0) 显示今天+昨天；回溯(1) 显示更早。 */
export function filterGroupsByView(groups: DayGroup[], viewMode: 0 | 1): DayGroup[] {
  return groups.filter((g) => (viewMode === 0 ? g.off <= 1 : g.off >= 2));
}

/** 今日更新数 = 今天发布的条目数。 */
export function updCount(room: RoomVM, now: Date): number {
  return room.items.filter((it) => dayOffset(it.publishedAt, now) <= 0).length;
}

export function latestItemTime(room: RoomVM): number {
  return room.items.reduce(
    (m, it) => Math.max(m, +new Date(it.publishedAt)),
    0,
  );
}

/** 首页排序：importance desc；同分用最近一条 Item 时间 desc（spec §4）。 */
export function sortedRooms(rooms: RoomVM[]): RoomVM[] {
  return [...rooms].sort(
    (a, b) => b.importance - a.importance || latestItemTime(b) - latestItemTime(a),
  );
}

/** 重要度点阵：返回 5 个布尔（前 n 个为 on）。 */
export function impCells(importance: number): boolean[] {
  return [0, 1, 2, 3, 4].map((i) => i < importance);
}

/** 时间是否落在 [since, until] 窗口内（两端可空表示无界）。用于按范围刷新。 */
export function inWindow(d: string | Date, since?: Date, until?: Date): boolean {
  const t = +new Date(d);
  if (since && t < +since) return false;
  if (until && t > +until) return false;
  return true;
}

/** 卡片显示标题优先级：用户自定义 > 原始 > 拟题 > 截断简介。 */
export function displayTitle(it: ItemVM): string {
  return (
    it.customTitle ||
    it.title ||
    it.aiTitle ||
    (it.excerpt ?? "").slice(0, 40) ||
    "(无标题)"
  );
}
