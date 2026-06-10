import test from "node:test";
import assert from "node:assert/strict";
import { truncate } from "../src/lib/text.ts";

test("truncate：短字符串原样返回", () => {
  assert.equal(truncate("hello", 20), "hello");
});

test("truncate：截断命中 emoji 代理对时仍保持 well-formed", () => {
  const out = truncate(`${"a".repeat(279)}😀tail`, 280);
  assert.equal(out.length <= 280, true);
  assert.equal(out.isWellFormed(), true);
});

test("truncate：源数据含孤立代理时归一为 well-formed", () => {
  const out = truncate("\ud83d", 10);
  assert.equal(out, "\ufffd");
  assert.equal(out.isWellFormed(), true);
});
