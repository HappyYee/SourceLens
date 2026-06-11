// Phase 0 验收：核对驱动渲染的纯逻辑（排序 / 按天分组 / 今日·回溯切换 / 时间·时长格式化）。
// 直接导入真实源码模块运行（node --test --experimental-strip-types）。
import test from "node:test";
import assert from "node:assert/strict";
import {
  dayOffset,
  displayTitle,
  filterGroupsByView,
  formatDuration,
  formatRelativeTime,
  groupByDay,
  impCells,
  sortItemsDesc,
  sortedRooms,
  updCount,
} from "../src/lib/view.ts";
import { getSampleRooms } from "../src/lib/sample-data.ts";
import type { ItemVM, Platform, RoomVM } from "../src/lib/types.ts";

const NOW = new Date(2026, 5, 7, 15, 0, 0); // 固定参考时刻（本地 15:00）

function atMin(minutesAgo: number): string {
  return new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
}
function atDay(dayOffset: number, hh = 12, mm = 0): string {
  const d = new Date(NOW);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayOffset);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}
function mkItem(id: string, publishedAt: string, extra: Partial<ItemVM> = {}): ItemVM {
  return {
    id,
    platform: "rss" as Platform,
    title: null,
    aiTitle: null,
    excerpt: null,
    url: "#",
    publishedAt,
    ...extra,
  };
}
function mkRoom(id: string, importance: number, items: ItemVM[]): RoomVM {
  return { id, name: id, type: "person", importance, bindings: ["rss"], items };
}

test("formatDuration: h:mm:ss / mm:ss", () => {
  assert.equal(formatDuration(2538), "42:18");
  assert.equal(formatDuration(7110), "1:58:30");
  assert.equal(formatDuration(535), "08:55");
  assert.equal(formatDuration(59), "00:59");
  assert.equal(formatDuration(3600), "1:00:00");
  assert.equal(formatDuration(0), null);
  assert.equal(formatDuration(null), null);
  assert.equal(formatDuration(undefined), null);
});

test("dayOffset: 今天=0 昨天=1 三天前=3", () => {
  assert.equal(dayOffset(NOW.toISOString(), NOW), 0);
  assert.equal(dayOffset(atDay(1, 8, 0), NOW), 1);
  assert.equal(dayOffset(atDay(3, 23, 0), NOW), 3);
});

test("groupByDay: 顺序今天→更早，标签正确，组内时间降序", () => {
  const items = [
    mkItem("a", atMin(120)), // 今天
    mkItem("b", atMin(300)), // 今天（更早）
    mkItem("c", atDay(1, 18, 0)), // 昨天
    mkItem("d", atDay(3, 10, 0)), // 3 天前
  ];
  const groups = groupByDay(items, NOW);
  assert.deepEqual(
    groups.map((g) => g.off),
    [0, 1, 3],
  );
  assert.deepEqual(
    groups.map((g) => g.label),
    ["今天", "昨天", "3 天前"],
  );
  // 今天组内 a(120min) 比 b(300min) 新 → a 在前
  assert.deepEqual(
    groups[0].items.map((i) => i.id),
    ["a", "b"],
  );
});

test("filterGroupsByView: 今日(0)=off<=1，回溯(1)=off>=2", () => {
  const groups = groupByDay(
    [mkItem("a", atMin(60)), mkItem("c", atDay(1, 9)), mkItem("d", atDay(3, 9))],
    NOW,
  );
  const today = filterGroupsByView(groups, 0).map((g) => g.off);
  const back = filterGroupsByView(groups, 1).map((g) => g.off);
  assert.deepEqual(today, [0, 1]);
  assert.deepEqual(back, [3]);
});

test("sortedRooms: importance desc，同分用最近 Item 时间 desc", () => {
  const a = mkRoom("A", 5, [mkItem("a1", atMin(60))]); // imp5，最新 60min 前
  const b = mkRoom("B", 5, [mkItem("b1", atMin(120))]); // imp5，最新 120min 前
  const c = mkRoom("C", 3, [mkItem("c1", atMin(10))]); // imp3
  const order = sortedRooms([b, c, a]).map((r) => r.id);
  assert.deepEqual(order, ["A", "B", "C"]); // A 比 B 新 → A 在前；C 最低分垫底
  // importance 非递增
  const imps = sortedRooms([b, c, a]).map((r) => r.importance);
  for (let i = 1; i < imps.length; i++) assert.ok(imps[i - 1] >= imps[i]);
});

test("updCount: 仅统计今天发布的条目", () => {
  const r = mkRoom("R", 4, [
    mkItem("x", atMin(30)),
    mkItem("y", atMin(200)),
    mkItem("z", atDay(2, 9)),
  ]);
  assert.equal(updCount(r, NOW), 2);
});

test("impCells / displayTitle", () => {
  assert.deepEqual(impCells(3), [true, true, true, false, false]);
  assert.equal(displayTitle(mkItem("t", atMin(1), { title: "原始标题" })), "原始标题");
  assert.equal(displayTitle(mkItem("t", atMin(1), { aiTitle: "AI 拟题" })), "AI 拟题");
  const long = "这是一段没有标题也没有 aiTitle 的很长很长很长很长很长很长很长很长很长很长很长很长的简介内容";
  assert.equal(displayTitle(mkItem("t", atMin(1), { excerpt: long })), long.slice(0, 40));
});

test("formatRelativeTime: 刚刚/分钟/小时/今天/昨天/N 天前", () => {
  assert.equal(formatRelativeTime(atMin(0.4), NOW), "刚刚");
  assert.equal(formatRelativeTime(atMin(30), NOW), "30 分钟前");
  assert.equal(formatRelativeTime(atMin(180), NOW), "3 小时前");
  assert.equal(formatRelativeTime(atDay(0, 2, 0), NOW), "今天 02:00"); // 同日但 >6h
  assert.equal(formatRelativeTime(atDay(1, 18, 5), NOW), "昨天 18:05");
  assert.equal(formatRelativeTime(atDay(3, 10, 0), NOW), "3 天前");
});

test("sortItemsDesc: 按 publishedAt 降序", () => {
  const items = [mkItem("old", atMin(500)), mkItem("new", atMin(10)), mkItem("mid", atMin(100))];
  assert.deepEqual(
    sortItemsDesc(items).map((i) => i.id),
    ["new", "mid", "old"],
  );
});

test("sample-data：elon 今日 2 条且回溯有内容；首页首位 importance=5", () => {
  const rooms = getSampleRooms(NOW);
  const elon = rooms.find((r) => r.id === "elon")!;
  assert.ok(elon, "存在 elon room");
  assert.equal(updCount(elon, NOW), 2); // 两条 minutesAgo 当日条目
  const back = filterGroupsByView(groupByDay(elon.items, NOW), 1);
  assert.ok(back.length > 0, "elon 回溯视图有更早内容");

  const sorted = sortedRooms(rooms);
  assert.equal(sorted[0].importance, 5);
  // anthropic 与 elon 同为 imp5，anthropic 最新条目更近 → 排在 elon 之前
  const ids = sorted.map((r) => r.id);
  assert.ok(ids.indexOf("anthropic") < ids.indexOf("elon"));
});

// —— Phase 3a：videoKind 归并过渡读取 —— //
import { effectiveVideoKind } from "../src/lib/view.ts";

test("effectiveVideoKind：videoKind 优先，回退 youtubeKind，都空为 null", () => {
  assert.equal(effectiveVideoKind({ videoKind: "video", youtubeKind: "short" }), "video");
  assert.equal(effectiveVideoKind({ videoKind: null, youtubeKind: "short" }), "short");
  assert.equal(effectiveVideoKind({}), null);
});
