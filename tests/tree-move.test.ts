// 节点挪动纯逻辑：环检测 + 同级顺序计算。
import test from "node:test";
import assert from "node:assert/strict";
import { planSiblingOrder, wouldCreateCycle } from "../src/lib/tree-move.ts";

const rows = [
  { id: "a", parentId: null },
  { id: "b", parentId: "a" },
  { id: "c", parentId: "b" },
  { id: "d", parentId: null },
];

test("wouldCreateCycle：移入自身/后代为环；顶层与无关分支不为环", () => {
  assert.equal(wouldCreateCycle(rows, "a", "c"), true); // a → 自己的孙子
  assert.equal(wouldCreateCycle(rows, "a", "a"), true); // 自身
  assert.equal(wouldCreateCycle(rows, "b", "d"), false);
  assert.equal(wouldCreateCycle(rows, "a", null), false); // 顶层
});

test("planSiblingOrder：after 插入 / 末尾兜底 / 自身剔除", () => {
  assert.deepEqual(planSiblingOrder(["x", "y", "z"], "m", "x"), ["x", "m", "y", "z"]);
  assert.deepEqual(planSiblingOrder(["x", "y"], "m", null), ["x", "y", "m"]);
  assert.deepEqual(planSiblingOrder(["x", "m", "y"], "m", "y"), ["x", "y", "m"]); // 同级内移动
  assert.deepEqual(planSiblingOrder(["x"], "m", "ghost"), ["x", "m"]); // afterId 不在同级 → 末尾
});
