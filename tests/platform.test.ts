import test from "node:test";
import assert from "node:assert/strict";
import { parseXInput } from "../src/lib/connectors/xpost.ts";
import { getAdapter } from "../src/lib/platform/registry.ts";
import { xAdapter } from "../src/lib/platform/x.ts";

test("registry：只注册 x adapter", () => {
  assert.equal(getAdapter("x"), xAdapter);
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
