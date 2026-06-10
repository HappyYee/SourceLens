// 国内/国外刷新通道解析 + 刷新结果文案（纯逻辑）。代理是否真正生效需在 Mac 联网环境验。
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveRegion,
  resolveRefreshNetwork,
  networkHint,
  formatOutcome,
  type RefreshOutcome,
} from "../src/lib/network.ts";

// —— 区域自动判定 ——

test("auto 解析：x → 国外（foreign）", () => {
  assert.equal(resolveRegion("x"), "foreign");
  const net = resolveRefreshNetwork({ platform: "x" });
  assert.equal(net.region, "foreign");
  assert.equal(net.humanLabel, "国外刷新");
});

test("auto 解析：youtube/twitter → 国外", () => {
  assert.equal(resolveRegion("youtube"), "foreign");
  assert.equal(resolveRegion("twitter"), "foreign");
});

test("auto 解析：bilibili → 国内（domestic）", () => {
  assert.equal(resolveRegion("bilibili"), "domestic");
  const net = resolveRefreshNetwork({ platform: "bilibili" });
  assert.equal(net.region, "domestic");
  assert.equal(net.humanLabel, "国内刷新");
});

test("显式 refreshRegion 覆盖平台默认（bilibili 强制 foreign）", () => {
  assert.equal(resolveRegion("bilibili", "foreign"), "foreign");
  const net = resolveRefreshNetwork({ platform: "bilibili", refreshRegion: "foreign" });
  assert.equal(net.region, "foreign");
});

// —— 代理决策 ——

test("国外刷新：默认走代理，并读取 HTTPS_PROXY", () => {
  const net = resolveRefreshNetwork({
    platform: "x",
    env: { HTTPS_PROXY: "http://127.0.0.1:33210" },
  });
  assert.equal(net.shouldUseProxy, true);
  assert.equal(net.proxyUrl, "http://127.0.0.1:33210");
  assert.equal(net.warning, undefined);
});

test("国外刷新：无 HTTPS_PROXY 时用默认代理并给出 warning", () => {
  const net = resolveRefreshNetwork({ platform: "x", env: {} });
  assert.equal(net.shouldUseProxy, true);
  assert.equal(net.proxyUrl, "http://127.0.0.1:33210");
  assert.match(net.warning ?? "", /HTTPS_PROXY/);
});

test("YouTube 国外刷新：无代理环境变量时使用默认 http 代理", () => {
  const net = resolveRefreshNetwork({ platform: "youtube", env: {} });
  assert.equal(net.region, "foreign");
  assert.equal(net.shouldUseProxy, true);
  assert.equal(net.proxyUrl, "http://127.0.0.1:33210");
});

test("国内刷新：默认直连，不走代理", () => {
  const net = resolveRefreshNetwork({
    platform: "bilibili",
    env: { HTTPS_PROXY: "http://127.0.0.1:33210" }, // 即使有代理变量也不用
  });
  assert.equal(net.shouldUseProxy, false);
  assert.equal(net.proxyUrl, undefined);
});

test("手动代理优先：proxyMode=manual 覆盖环境变量与区域默认", () => {
  const net = resolveRefreshNetwork({
    platform: "bilibili", // 即便国内，手动代理也生效
    proxyMode: "manual",
    proxyUrl: "http://127.0.0.1:7890",
    env: { HTTPS_PROXY: "http://127.0.0.1:33210" },
  });
  assert.equal(net.shouldUseProxy, true);
  assert.equal(net.proxyUrl, "http://127.0.0.1:7890");
});

test("proxyMode=none：即使国外也不走代理", () => {
  const net = resolveRefreshNetwork({
    platform: "x",
    proxyMode: "none",
    env: { HTTPS_PROXY: "http://127.0.0.1:33210" },
  });
  assert.equal(net.shouldUseProxy, false);
  assert.equal(net.proxyUrl, undefined);
});

// —— 结果文案 ——

test("formatOutcome：ok=true 成功（带计数）", () => {
  const o: RefreshOutcome = {
    ok: true,
    action: "backfill",
    platform: "youtube",
    refreshRegion: "foreign",
    networkLabel: "国外刷新",
    createdCount: 15,
    updatedCount: 0,
    scannedCount: 15,
  };
  const s = formatOutcome(o);
  assert.match(s, /国外刷新成功/);
  assert.match(s, /\+15 新/);
  assert.match(s, /已扫描 15/);
});

test("formatOutcome：ok=true 但零计数 → 没有新内容", () => {
  const o: RefreshOutcome = {
    ok: true,
    action: "refresh_latest",
    platform: "bilibili",
    refreshRegion: "domestic",
    networkLabel: "国内刷新",
    createdCount: 0,
    updatedCount: 0,
    scannedCount: 0,
  };
  assert.equal(formatOutcome(o), "国内刷新成功：没有新内容");
});

test("formatOutcome：check_auth 已登录", () => {
  const o: RefreshOutcome = {
    ok: true,
    action: "check_auth",
    platform: "x",
    refreshRegion: "foreign",
    networkLabel: "国外刷新",
  };
  assert.equal(formatOutcome(o), "国外刷新 · 已登录");
});

test("formatOutcome：ok=false 失败带 error + hint", () => {
  const o: RefreshOutcome = {
    ok: false,
    action: "backfill",
    platform: "youtube",
    refreshRegion: "foreign",
    networkLabel: "国外刷新",
    error: "fetch failed: timeout",
    hint: networkHint("foreign", "fetch failed: timeout"),
  };
  const s = formatOutcome(o);
  assert.match(s, /国外刷新失败/);
  assert.match(s, /timeout/);
  assert.match(s, /HTTPS_PROXY/); // 提示里包含代理排查
});

// —— 网络提示 ——

test("networkHint：国外超时 → 提示检查 HTTPS_PROXY / 代理", () => {
  const h = networkHint("foreign", "UND_ERR_CONNECT_TIMEOUT");
  assert.ok(h);
  assert.match(h!, /HTTPS_PROXY|代理/);
});

test("networkHint：国内失败 → 提示本机网络，不提国外代理", () => {
  const h = networkHint("domestic", "fetch failed");
  assert.ok(h);
  assert.match(h!, /本机网络|目标平台/);
  assert.doesNotMatch(h!, /HTTPS_PROXY/);
});

test("networkHint：非网络类错误 → 不返回提示（不误导）", () => {
  assert.equal(networkHint("foreign", "缺少 YOUTUBE_API_KEY"), undefined);
  assert.equal(networkHint("domestic", "该 source 缺少频道 ID"), undefined);
  assert.equal(networkHint("foreign"), undefined);
});
