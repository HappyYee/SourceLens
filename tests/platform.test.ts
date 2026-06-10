import test from "node:test";
import assert from "node:assert/strict";
import { parseBilibiliInput } from "../src/lib/connectors/bilibili.ts";
import { parseXInput } from "../src/lib/connectors/xpost.ts";
import { bilibiliAdapter } from "../src/lib/platform/bilibili.ts";
import { getAdapter } from "../src/lib/platform/registry.ts";
import { xAdapter } from "../src/lib/platform/x.ts";
import { youtubeAdapter } from "../src/lib/platform/youtube.ts";

test("registry：注册 x / bilibili / youtube adapter，rss/manual 仍无 adapter", () => {
  assert.equal(getAdapter("x"), xAdapter);
  assert.equal(getAdapter("bilibili"), bilibiliAdapter);
  assert.equal(getAdapter("youtube"), youtubeAdapter);
  assert.equal(getAdapter("rss"), undefined);
  assert.equal(getAdapter("manual"), undefined);
});

test("x adapter：resolveSourceInput 与 parseXInput 等价", () => {
  assert.equal(xAdapter.resolveSourceInput("@elonmusk"), parseXInput("@elonmusk"));
  assert.equal(
    xAdapter.resolveSourceInput("https://x.com/elonmusk/status/1"),
    parseXInput("https://x.com/elonmusk/status/1"),
  );
  assert.equal(xAdapter.resolveSourceInput("https://x.com/home"), null);
});

test("x adapter：auth requirement 与 capabilities", () => {
  assert.equal(xAdapter.checkAuthRequirement(), "browserProfile");
  const cap = xAdapter.getCapabilities();
  assert.equal(cap.latestRefresh, true);
  assert.equal(cap.backfill, true);
  assert.equal(cap.tagsSync, false);
  assert.equal(cap.authRequired, true);
  assert.equal(cap.authOptional, false);
  assert.equal(cap.mediaSupport, true);
  assert.equal(cap.debugSupport, false);
  assert.equal(cap.commentsSupported, false);
  assert.equal(cap.downloadsSupported, false);
  assert.equal(cap.writesSupported, false);
});

test("x adapter：输入错误文案保持不变", async () => {
  await assert.rejects(
    () => xAdapter.refreshLatest("", { useProxy: false }),
    /无法解析 X 用户名：请填 @handle 或 x\.com\/\{handle\} 链接/,
  );
});

test("x adapter：缺登录态错误文案保持不变且不触发浏览器导入", async () => {
  await assert.rejects(
    () => xAdapter.refreshLatest("@elonmusk", { useProxy: true, proxyUrl: "http://127.0.0.1:33210" }),
    /需要 X 登录态：请先在设置页创建 x 登录态并登录后重试/,
  );
});

test("bilibili adapter：resolveSourceInput 与 parseBilibiliInput 等价", () => {
  assert.equal(bilibiliAdapter.resolveSourceInput("3493131016211048"), parseBilibiliInput("3493131016211048"));
  assert.equal(
    bilibiliAdapter.resolveSourceInput("https://space.bilibili.com/3493131016211048/video"),
    parseBilibiliInput("https://space.bilibili.com/3493131016211048/video"),
  );
  assert.equal(bilibiliAdapter.resolveSourceInput("not a mid"), null);
});

test("bilibili adapter：auth optional，红线能力关闭", () => {
  assert.equal(bilibiliAdapter.checkAuthRequirement(), "none");
  const cap = bilibiliAdapter.getCapabilities();
  assert.equal(cap.latestRefresh, true);
  assert.equal(cap.backfill, true);
  assert.equal(cap.tagsSync, false);
  assert.equal(cap.authRequired, false);
  assert.equal(cap.authOptional, true);
  assert.equal(cap.mediaSupport, false);
  assert.equal(cap.debugSupport, false);
  assert.equal(cap.commentsSupported, false);
  assert.equal(cap.downloadsSupported, false);
  assert.equal(cap.writesSupported, false);
});

test("bilibili adapter：输入错误文案保持不变", async () => {
  await assert.rejects(
    () => bilibiliAdapter.refreshLatest("not a mid", { useProxy: false }),
    /无法解析 B 站 UP 主：请填 mid 或 space\.bilibili\.com\/\{mid\} 链接/,
  );
});

test("youtube adapter：resolveSourceInput 支持 UC ID / handle / 链接", () => {
  const channelId = "UCuAXFkgsw1L7xaCfnd5JJOw";
  assert.equal(youtubeAdapter.resolveSourceInput(channelId), channelId);
  assert.equal(youtubeAdapter.resolveSourceInput("@MeiTouJun"), "@MeiTouJun");
  assert.equal(youtubeAdapter.resolveSourceInput("https://www.youtube.com/@MeiTouJun"), "@MeiTouJun");
  assert.equal(youtubeAdapter.resolveSourceInput("not a youtube source"), null);
});

test("youtube adapter：apiKey optional，支持 tagsSync，红线能力关闭", () => {
  assert.equal(youtubeAdapter.checkAuthRequirement(), "apiKeyOptional");
  const cap = youtubeAdapter.getCapabilities();
  assert.equal(cap.latestRefresh, true);
  assert.equal(cap.backfill, true);
  assert.equal(cap.tagsSync, true);
  assert.equal(cap.authRequired, false);
  assert.equal(cap.authOptional, false);
  assert.equal(cap.mediaSupport, false);
  assert.equal(cap.debugSupport, false);
  assert.equal(cap.commentsSupported, false);
  assert.equal(cap.downloadsSupported, false);
  assert.equal(cap.writesSupported, false);
});

test("youtube adapter：空 source 文案保持不变", async () => {
  await assert.rejects(
    () => youtubeAdapter.refreshLatest("", { useProxy: true, proxyUrl: "http://127.0.0.1:33210" }),
    /YouTube 绑定需要频道 ID（UC… 开头）或 feed URL/,
  );
});
