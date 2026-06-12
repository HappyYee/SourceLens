// 刷新执行计划：分组保序（平台内串行顺序 = 原顺序）。
import test from "node:test";
import assert from "node:assert/strict";
import { groupBindingsByPlatform } from "../src/lib/refresh-plan.ts";

test("groupBindingsByPlatform：按平台分组、组内保持原顺序、组序为首见序", () => {
  const rows = [
    { id: "a", platform: "youtube" },
    { id: "b", platform: "x" },
    { id: "c", platform: "youtube" },
    { id: "d", platform: "rss" },
  ];
  const g = groupBindingsByPlatform(rows);
  assert.deepEqual(
    g.map((rows) => rows.map((r) => r.id)),
    [["a", "c"], ["b"], ["d"]],
  );
  assert.deepEqual(groupBindingsByPlatform([]), []);
});
