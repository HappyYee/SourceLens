// 导出载荷组装：结构与 AuthProfile 排除边界。
import test from "node:test";
import assert from "node:assert/strict";
import { buildExportPayload } from "../src/lib/export-data.ts";

test("buildExportPayload：顶层键固定，counts 正确，永无 authProfiles", () => {
  const p = buildExportPayload(
    { rooms: [{}], roomTypes: [], bindings: [{}, {}], items: [{}, {}, {}] },
    { exportedAt: "2026-06-12T00:00:00.000Z", migration: "m1" },
  );
  assert.deepEqual(Object.keys(p).sort(), ["bindings", "items", "meta", "roomTypes", "rooms"]);
  assert.deepEqual(p.meta.counts, { rooms: 1, roomTypes: 0, bindings: 2, items: 3 });
  assert.equal(p.meta.migration, "m1");
  assert.ok(!JSON.stringify(Object.keys(p)).includes("authProfile"));
});
