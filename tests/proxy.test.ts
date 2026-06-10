// 代理选择优先级（纯函数）。实际 ProxyAgent 生效需在 Mac 联网环境验。
import test from "node:test";
import assert from "node:assert/strict";
import { isHttpProxyUrl, pickProxyUrl } from "../src/lib/proxy-url.ts";

test("pickProxyUrl: 优先级 HTTPS > HTTP > ALL，大写优先小写", () => {
  assert.equal(
    pickProxyUrl({ HTTPS_PROXY: "http://h", HTTP_PROXY: "http://p", ALL_PROXY: "socks5://a" }),
    "http://h",
  );
  assert.equal(pickProxyUrl({ HTTP_PROXY: "http://p", ALL_PROXY: "socks5://a" }), "http://p");
  assert.equal(pickProxyUrl({ ALL_PROXY: "socks5://a" }), "socks5://a");
  assert.equal(pickProxyUrl({ https_proxy: "http://lo" }), "http://lo");
  assert.equal(pickProxyUrl({ HTTPS_PROXY: "http://up", https_proxy: "http://lo" }), "http://up");
  assert.equal(pickProxyUrl({}), null);
});

test("isHttpProxyUrl: 仅 http(s) 代理可交给 undici ProxyAgent", () => {
  assert.equal(isHttpProxyUrl("http://127.0.0.1:33210"), true);
  assert.equal(isHttpProxyUrl("https://proxy.example.com:443"), true);
  assert.equal(isHttpProxyUrl("socks5://127.0.0.1:1080"), false);
  assert.equal(isHttpProxyUrl(""), false);
  assert.equal(isHttpProxyUrl(null), false);
  assert.equal(isHttpProxyUrl(undefined), false);
});
