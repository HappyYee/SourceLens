// IA：纯树逻辑（导航树、子孙集合、完整路径、folder 扁平化 + 父级选择排除）。
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTree,
  descendantIds,
  flattenFolders,
  nodePath,
} from "../src/lib/tree.ts";
import type { TreeRow } from "../src/lib/tree.ts";

const rows: TreeRow[] = [
  { id: "nogi", name: "乃木坂46", nodeKind: "folder", parentId: null, sortOrder: 0 },
  { id: "g5", name: "5期生", nodeKind: "folder", parentId: "nogi", sortOrder: 1 },
  { id: "g4", name: "4期生", nodeKind: "folder", parentId: "nogi", sortOrder: 0 },
  { id: "inoue", name: "井上和", nodeKind: "room", parentId: "g5", sortOrder: 0 },
  { id: "lab", name: "AI 实验室", nodeKind: "folder", parentId: null, sortOrder: 1 },
  { id: "anthropic", name: "Anthropic", nodeKind: "room", parentId: "lab", sortOrder: 0 },
];

test("buildTree: 任意深度嵌套，同级按 sortOrder", () => {
  const tree = buildTree(rows);
  assert.deepEqual(tree.map((n) => n.row.id), ["nogi", "lab"]);
  const nogi = tree[0];
  assert.deepEqual(nogi.children.map((c) => c.row.id), ["g4", "g5"]); // sortOrder 0,1
  const g5 = nogi.children.find((c) => c.row.id === "g5")!;
  assert.deepEqual(g5.children.map((c) => c.row.id), ["inoue"]);
});

test("descendantIds: 自身的所有子孙（不含自己）", () => {
  assert.deepEqual([...descendantIds(rows, "nogi")].sort(), ["g4", "g5", "inoue"].sort());
  assert.equal(descendantIds(rows, "inoue").size, 0);
});

test("nodePath: 完整路径（重名靠路径区分）", () => {
  assert.deepEqual(nodePath(rows, "inoue"), ["乃木坂46", "5期生", "井上和"]);
  assert.deepEqual(nodePath(rows, "nogi"), ["乃木坂46"]);
});

test("flattenFolders: 只列 folder（room 不可作父级）", () => {
  const all = flattenFolders(rows);
  assert.deepEqual(all.map((f) => f.id).sort(), ["g4", "g5", "lab", "nogi"].sort());
  assert.ok(!all.some((f) => f.id === "inoue" || f.id === "anthropic"));
  assert.deepEqual(all.find((f) => f.id === "g5")!.path, ["乃木坂46", "5期生"]);
});

test("flattenFolders: parent picker 排除自身 + 子孙（防自指/成环）", () => {
  const forNogi = flattenFolders(rows, "nogi");
  // 排除 nogi 自己 + 子孙 g4/g5/inoue → 只剩 lab
  assert.deepEqual(forNogi.map((f) => f.id), ["lab"]);
  // 给 g5 选父级：排除 g5 + inoue → 剩 nogi / g4 / lab（不含自己）
  const forG5 = flattenFolders(rows, "g5").map((f) => f.id).sort();
  assert.deepEqual(forG5, ["g4", "lab", "nogi"].sort());
  assert.ok(!forG5.includes("g5"));
});
