// AuthProfile 专用 profile 目录的纯路径逻辑 + 安全校验 + .gitignore 防泄漏。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import {
  slug,
  profileDirName,
  isWithin,
  authProfileDir,
  isSafeProfileDir,
} from "../src/lib/authprofile.ts";

// 固定数据目录，保证断言稳定（getDataDir 在调用时读取该变量）。
const DATA = "/tmp/sl-test-data";
process.env.SOURCELENS_DATA_DIR = DATA;
const PROFILES = join(DATA, "browser-profiles");

// —— profileDir 生成 ——

test("profileDirName：x/main → x-main", () => {
  assert.equal(profileDirName("x", "main"), "x-main");
});

test("profileDirName：x 与 bilibili 相互独立（不会撞目录）", () => {
  const x = profileDirName("x", "main");
  const b = profileDirName("bilibili", "main");
  assert.equal(x, "x-main");
  assert.equal(b, "bilibili-main");
  assert.notEqual(x, b);
});

test("slug：清洗非法字符、空白回退为 main", () => {
  assert.equal(slug("My Account!!"), "my-account");
  assert.equal(slug("  "), "main");
  assert.equal(slug("马斯克"), "main"); // 非 ascii 全部剥离后回退
  assert.equal(slug("a/b\\c"), "a-b-c");
});

test("authProfileDir：落在 data/browser-profiles 下", () => {
  const dir = authProfileDir("x", "main");
  assert.equal(dir, join(PROFILES, "x-main"));
  assert.equal(isSafeProfileDir(dir), true);
});

// —— 安全校验 ——

test("isWithin：base 内为真，base 外为假", () => {
  assert.equal(isWithin(PROFILES, join(PROFILES, "x-main")), true);
  assert.equal(isWithin(PROFILES, PROFILES), true);
  assert.equal(isWithin(PROFILES, join(DATA, "db")), false);
  assert.equal(isWithin(PROFILES, "/etc/passwd"), false);
});

test("isSafeProfileDir：拒绝指向项目外 / 上跳路径", () => {
  assert.equal(isSafeProfileDir(resolve(PROFILES, "../../../../etc")), false);
  assert.equal(isSafeProfileDir("/Users/someone/Library/Chrome"), false);
  assert.equal(isSafeProfileDir(join(PROFILES, "bilibili-main")), true);
});

test("删除 AuthProfile 不应能波及 data/db（db 目录不在安全范围内）", () => {
  // DELETE 仅在 isSafeProfileDir 为真时 rmSync(profileDir)；db 目录必须为 false。
  assert.equal(isSafeProfileDir(join(DATA, "db")), false);
  assert.equal(isSafeProfileDir(join(DATA, "db", "sourcelens.db")), false);
});

// —— 防泄漏：.gitignore ——

test(".gitignore 必须忽略 data/browser-profiles（不上传登录态）", () => {
  const p = fileURLToPath(new URL("../.gitignore", import.meta.url));
  const txt = readFileSync(p, "utf8");
  assert.match(txt, /browser-profiles/);
});
