import test from "node:test";
import assert from "node:assert/strict";
import { classifyError } from "../src/lib/report.ts";
import { networkHint } from "../src/lib/network.ts";

test("classifyError：profile_busy 识别 browserCode 与 SingletonLock", () => {
  assert.equal(classifyError("anything", "profile_busy"), "profile_busy");
  assert.equal(
    classifyError("Failed to create profile SingletonLock: File exists"),
    "profile_busy",
  );
});

test("classifyError：environment 先于 not_found", () => {
  assert.equal(
    classifyError("找不到本机 Chrome（channel=chrome）。请安装 Google Chrome 后重试"),
    "environment",
  );
  assert.equal(classifyError("无法加载 playwright-core（import 失败）：Cannot find module"), "environment");
  assert.equal(classifyError("profile 目录不可写：/tmp/source（EACCES）"), "environment");
  assert.equal(classifyError("启动浏览器失败：spawn chrome ENOENT"), "environment");
});

test("classifyError：network", () => {
  assert.equal(classifyError("fetch failed"), "network");
  assert.equal(
    classifyError("请求超时（dev 是否在导出了 HTTPS_PROXY 的同一 shell 里启动？）"),
    "network",
  );
  assert.equal(classifyError("网络错误：socket hang up（国外刷新需要可用的 http 代理）"), "network");
});

test("classifyError：quota", () => {
  assert.equal(classifyError("YouTube API 配额已用尽（quota exceeded）"), "quota");
});

test("classifyError：auth_expired", () => {
  assert.equal(classifyError("未登录或登录态失效：请在设置页打开 X 登录窗口重新登录"), "auth_expired");
  assert.equal(
    classifyError("需要 X 登录态：请先在设置页创建 x 登录态并登录后重试"),
    "auth_expired",
  );
});

test("classifyError：input", () => {
  assert.equal(
    classifyError("无法解析 X 用户名：请填 @handle 或 x.com/{handle} 链接"),
    "input",
  );
  assert.equal(
    classifyError("无法解析 B 站 UP 主：请填 mid 或 space.bilibili.com/{mid} 链接"),
    "input",
  );
  assert.equal(classifyError("缺少 YOUTUBE_API_KEY（在 .env 配置后重启 dev）"), "input");
  assert.equal(classifyError("无法解析 feed URL（检查 feedUrl / query）"), "input");
  assert.equal(classifyError("YouTube 绑定需要频道 ID（UC… 开头）或 feed URL"), "input");
});

test("classifyError：not_found / unknown", () => {
  assert.equal(classifyError("找不到频道 @somehandle"), "not_found");
  assert.equal(classifyError("某个没有特征的错误"), "unknown");
});

test("networkHint：搬家后网络错误提示行为保持等价", () => {
  for (const msg of [
    "fetch failed",
    "请求超时（dev 是否在导出了 HTTPS_PROXY 的同一 shell 里启动？）",
    "网络错误：socket hang up（国外刷新需要可用的 http 代理）",
  ]) {
    assert.match(networkHint("foreign", msg) ?? "", /HTTPS_PROXY|代理/);
  }
  for (const msg of [
    "YouTube API 配额已用尽（quota exceeded）",
    "无法解析 X 用户名：请填 @handle 或 x.com/{handle} 链接",
    "缺少 YOUTUBE_API_KEY（在 .env 配置后重启 dev）",
  ]) {
    assert.equal(networkHint("foreign", msg), undefined);
  }
});
