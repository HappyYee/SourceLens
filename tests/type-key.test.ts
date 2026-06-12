import test from "node:test";
import assert from "node:assert/strict";
import { uniqueTypeKey } from "../src/lib/type-key.ts";

test("uniqueTypeKey：slug 化、- 转 _、冲突追加 _2、空名兜底 type", () => {
  assert.equal(uniqueTypeKey("Idol Member", []), "idol_member");
  assert.equal(uniqueTypeKey("偶像成员", []), "type"); // 纯中文 slug 为空 → 兜底
  assert.equal(uniqueTypeKey("Lab", ["lab"]), "lab_2");
  assert.equal(uniqueTypeKey("Lab", ["lab", "lab_2"]), "lab_3");
});
