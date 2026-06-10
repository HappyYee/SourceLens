// 拟题与显示优先级：规则拟题(去URL/@/RT + 首句 + 兜底)、降级、customTitle 优先。
import test from "node:test";
import assert from "node:assert/strict";
import {
  degradeTitle,
  generateTitle,
  ruleTitle,
  stripForTitle,
} from "../src/lib/ai/title.ts";
import { displayTitle } from "../src/lib/view.ts";
import type { ItemVM } from "../src/lib/types.ts";

test("stripForTitle: 去 URL / 开头@回复 / RT 前缀 / 折叠空白", () => {
  assert.equal(stripForTitle("@alice @bob 看看这个 https://x.com/a 很好"), "看看这个 很好");
  assert.equal(stripForTitle("RT @news: 重大消息 http://t.co/x"), "重大消息");
  assert.equal(stripForTitle("  多个   空格\n换行 "), "多个 空格 换行");
});

test("ruleTitle: 首句 + 纯链接/纯媒体/空 兜底", () => {
  assert.equal(ruleTitle("发布了一段产品演示。细节在视频里"), "发布了一段产品演示");
  assert.equal(ruleTitle("https://x.com/only/link"), "分享了一条链接");
  assert.equal(ruleTitle("   "), "发布了一条短更新");
  assert.equal(ruleTitle("", { hasMedia: true }), "分享了一张图片");
});

test("degradeTitle: 取首句 / 截断 40", () => {
  assert.equal(degradeTitle("关于世界模型的一段长推文。后面还有很多内容"), "关于世界模型的一段长推文");
  assert.equal(degradeTitle("Hello world. Next sentence."), "Hello world");
  const long = "一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五";
  assert.equal(degradeTitle(long).length, 40);
});

test("ruleTitle: 截断命中 emoji 代理对时仍保持 well-formed", () => {
  const title = ruleTitle(`${"a".repeat(39)}😀tail`);
  assert.equal(title.length <= 40, true);
  assert.equal(title.isWellFormed(), true);
});

test("generateTitle: 空→null；无 key→规则降级", async () => {
  assert.equal(await generateTitle(""), null);
  assert.equal(await generateTitle(null), null);
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    assert.equal(await generateTitle("发布了一段产品演示。细节在视频里"), "发布了一段产品演示");
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test("displayTitle 优先级：customTitle > title > aiTitle > excerpt", () => {
  const base: ItemVM = {
    id: "i",
    platform: "x",
    title: null,
    aiTitle: "规则标题",
    excerpt: "一段正文",
    url: "#",
    publishedAt: "2026-06-01T00:00:00.000Z",
  };
  assert.equal(displayTitle(base), "规则标题"); // 无 title → aiTitle
  assert.equal(displayTitle({ ...base, title: "原始标题" }), "原始标题"); // title 压过 aiTitle
  assert.equal(
    displayTitle({ ...base, title: "原始标题", customTitle: "我的标题" }),
    "我的标题",
  ); // custom 最高
});
