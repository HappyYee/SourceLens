import test from "node:test";
import assert from "node:assert/strict";
import { bilibiliSrcLabel, xSrcLabel, youtubeSrcLabel } from "../src/components/cards/labels.ts";
import { sqClass, thumbClass } from "../src/components/cards/shared.ts";

test("thumbClass：undefined/null/正负数取模到 t0..t3", () => {
  assert.equal(thumbClass(), "t0");
  assert.equal(thumbClass(null), "t0");
  assert.equal(thumbClass(0), "t0");
  assert.equal(thumbClass(1), "t1");
  assert.equal(thumbClass(4), "t0");
  assert.equal(thumbClass(5), "t1");
  assert.equal(thumbClass(-1), "t3");
  assert.equal(thumbClass(-4), "t0");
  assert.equal(thumbClass(-5), "t3");
});

test("sqClass：平台映射保持 ItemCard 原样", () => {
  assert.equal(sqClass("arxiv"), "s0");
  assert.equal(sqClass("podcast"), "s2");
  assert.equal(sqClass("bilibili"), "s3");
  assert.equal(sqClass("rss"), "s1");
  assert.equal(sqClass("youtube"), "s1");
  assert.equal(sqClass("github"), "s1");
  assert.equal(sqClass("x"), "s1");
  assert.equal(sqClass("manual"), "s1");
});

test("labels：xSrcLabel", () => {
  assert.equal(xSrcLabel(null), "X · Post");
  assert.equal(xSrcLabel(undefined), "X · Post");
  assert.equal(xSrcLabel("quote"), "X · Quote");
  assert.equal(xSrcLabel("not-real"), "X · Post");
});

test("labels：youtubeSrcLabel", () => {
  assert.equal(youtubeSrcLabel("short"), "YouTube · Shorts");
  assert.equal(youtubeSrcLabel("video"), null);
  assert.equal(youtubeSrcLabel(null), null);
});

test("labels：bilibiliSrcLabel", () => {
  assert.equal(bilibiliSrcLabel("short"), "Bilibili · Short");
  assert.equal(bilibiliSrcLabel("video"), "Bilibili");
  assert.equal(bilibiliSrcLabel(null), "Bilibili");
});
