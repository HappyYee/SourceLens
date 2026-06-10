import test from "node:test";
import assert from "node:assert/strict";
import {
  X_EXPIRED_URL_RE,
  classifyXLoginSignal,
  isProfileBusyError,
  mapLaunchError,
} from "../src/lib/browser.ts";

test("X_EXPIRED_URL_RE：明确登录/风控 URL 命中，普通路径不误伤", () => {
  assert.equal(X_EXPIRED_URL_RE.test("https://x.com/login"), true);
  assert.equal(X_EXPIRED_URL_RE.test("https://x.com/i/flow/login?redirect_after_login=%2Fhome"), true);
  assert.equal(X_EXPIRED_URL_RE.test("https://x.com/account/access?lang=zh"), true);
  assert.equal(X_EXPIRED_URL_RE.test("https://x.com/home"), false);
  assert.equal(X_EXPIRED_URL_RE.test("https://x.com/elonmusk"), false);
  assert.equal(X_EXPIRED_URL_RE.test("https://x.com/loginworld"), false);
});

test("classifyXLoginSignal：URL / 已登录 UI / 未登录 UI / 不确定", () => {
  assert.equal(
    classifyXLoginSignal({
      url: "https://x.com/i/flow/login",
      hasLoggedInUi: true,
      hasLoggedOutUi: false,
    }),
    "expired",
  );
  assert.equal(
    classifyXLoginSignal({
      url: "https://x.com/home",
      hasLoggedInUi: true,
      hasLoggedOutUi: false,
    }),
    "logged_in",
  );
  assert.equal(
    classifyXLoginSignal({
      url: "https://x.com/home",
      hasLoggedInUi: false,
      hasLoggedOutUi: true,
    }),
    "expired",
  );
  assert.equal(
    classifyXLoginSignal({
      url: "https://x.com/home",
      hasLoggedInUi: false,
      hasLoggedOutUi: false,
    }),
    null,
  );
});

test("isProfileBusyError：识别 profile 占用错误，不误伤普通启动错误", () => {
  assert.equal(isProfileBusyError("Failed to create ProcessSingleton for profile directory"), true);
  assert.equal(isProfileBusyError("SingletonLock: File exists"), true);
  assert.equal(isProfileBusyError("profile directory is already running and in use"), true);
  assert.equal(isProfileBusyError("cannot create lock file"), true);
  assert.equal(isProfileBusyError("executable doesn't exist at /Applications/Google Chrome.app"), false);
});

test("mapLaunchError：profile busy 优先于 chrome_missing，ENOENT 仍是 chrome_missing", () => {
  const busy = mapLaunchError(
    new Error("Failed to launch: Failed to create a ProcessSingleton; SingletonLock: File exists"),
  );
  assert.equal(busy.code, "profile_busy");
  assert.match(busy.message, /登录窗口可能仍在打开/);

  const missing = mapLaunchError(new Error("ENOENT: executable doesn't exist at /missing/chrome"));
  assert.equal(missing.code, "chrome_missing");
});
