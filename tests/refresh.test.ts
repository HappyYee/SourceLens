// 三模式刷新的核心逻辑：时间窗口过滤 + arXiv 分页 URL。
import test from "node:test";
import assert from "node:assert/strict";
import { inWindow } from "../src/lib/view.ts";
import { buildArxivUrl } from "../src/lib/connectors/arxiv.ts";

test("inWindow: since/until 边界（含两端、无界）", () => {
  const since = new Date("2026-06-01T00:00:00.000Z");
  const until = new Date("2026-06-07T00:00:00.000Z");
  assert.ok(inWindow("2026-06-03T00:00:00.000Z", since, until));
  assert.ok(inWindow(since, since, until)); // 下界含
  assert.ok(inWindow(until, since, until)); // 上界含
  assert.ok(!inWindow("2026-05-31T23:59:59.000Z", since, until));
  assert.ok(!inWindow("2026-06-07T00:00:01.000Z", since, until));
  assert.ok(inWindow("2026-06-03T00:00:00.000Z")); // 全无界 → 恒真
  assert.ok(inWindow("1999-01-01T00:00:00.000Z", undefined, until)); // 仅上界
});

test("buildArxivUrl: start 分页与默认排序", () => {
  const u = buildArxivUrl("cat:cs.AI", 50, 100);
  assert.match(u, /start=100/);
  assert.match(u, /max_results=50/);
  assert.match(u, /sortBy=submittedDate&sortOrder=descending/);
  assert.match(buildArxivUrl("cat:cs.AI"), /start=0/); // 默认首页
});
