import test from "node:test";
import assert from "node:assert/strict";
import {
  clampImportance,
  detectPlatform,
  isPlatform,
  normalizeRoomType,
  PLATFORMS,
} from "../src/lib/validate.ts";

test("clampImportance: 限制 1..5，非法回落 3，四舍五入", () => {
  assert.equal(clampImportance(0), 1);
  assert.equal(clampImportance(7), 5);
  assert.equal(clampImportance(3), 3);
  assert.equal(clampImportance(4.4), 4);
  assert.equal(clampImportance("x" as unknown), 3);
  assert.equal(clampImportance(undefined), 3);
  assert.equal(clampImportance(NaN), 3);
});

test("isPlatform: 仅认 8 个合法平台（含 bilibili）", () => {
  assert.ok(isPlatform("youtube"));
  assert.ok(isPlatform("bilibili"));
  assert.ok(isPlatform("arxiv"));
  assert.ok(!isPlatform("tiktok"));
  assert.ok(!isPlatform(123 as unknown));
  assert.equal(PLATFORMS.length, 8);
});

test("normalizeRoomType: 空→person", () => {
  assert.equal(normalizeRoomType("company"), "company");
  assert.equal(normalizeRoomType("folder"), "folder");
  assert.equal(normalizeRoomType(""), "person");
  assert.equal(normalizeRoomType(undefined), "person");
});

test("detectPlatform: 按 URL 识别（修复粘贴全变 X 的 bug）", () => {
  assert.equal(detectPlatform("https://www.youtube.com/watch?v=abc"), "youtube");
  assert.equal(detectPlatform("https://youtu.be/abc"), "youtube");
  assert.equal(detectPlatform("https://x.com/elonmusk/status/123"), "x");
  assert.equal(detectPlatform("https://twitter.com/jack/status/1"), "x");
  assert.equal(detectPlatform("https://github.com/openai/openai-python"), "github");
  assert.equal(detectPlatform("https://example.com/post/1"), "manual");
  assert.equal(detectPlatform(""), "manual");
});
