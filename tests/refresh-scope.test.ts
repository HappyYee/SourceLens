// 刷新时间窗解析（U1）：today/week/range/all/缺省 五种语义。
import test from "node:test";
import assert from "node:assert/strict";
import { parseScope, scopeWindow } from "../src/lib/refresh-scope.ts";

const now = new Date("2026-06-12T15:30:00");

test("scopeWindow：today = 本地零点起、until=now、不深翻", () => {
  const w = scopeWindow("today", now);
  assert.equal(w.since!.getHours(), 0);
  assert.equal(w.since!.getMinutes(), 0);
  assert.equal(+w.until!, +now);
  assert.equal(w.deep, false);
});

test("scopeWindow：week = 滚动 7 天", () => {
  const w = scopeWindow("week", now);
  assert.equal(+now - +w.since!, 7 * 24 * 60 * 60 * 1000);
  assert.equal(+w.until!, +now);
  assert.equal(w.deep, false);
});

test("scopeWindow：all = 无下界 + 深翻；range 非法日期归 undefined", () => {
  const a = scopeWindow("all", now);
  assert.equal(a.since, undefined);
  assert.equal(a.deep, true);
  const r = scopeWindow("range", now, "not-a-date", "2026-06-10T00:00:00.000Z");
  assert.equal(r.since, undefined);
  assert.equal(r.until!.toISOString(), "2026-06-10T00:00:00.000Z");
  assert.equal(r.deep, true);
});

test("scopeWindow：缺省 = 无窗口不深翻（检查更新语义）；parseScope 只认已知值", () => {
  const w = scopeWindow(undefined, now);
  assert.deepEqual(w, { deep: false });
  assert.equal(parseScope("week"), "week");
  assert.equal(parseScope("ALL"), undefined);
  assert.equal(parseScope(42), undefined);
});
