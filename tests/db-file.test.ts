// SQLite url 解析与文件名时间戳（纯函数）。
import test from "node:test";
import assert from "node:assert/strict";
import { resolveSqliteUrl, timestampSlug } from "../src/lib/db-file.ts";

test("resolveSqliteUrl：相对路径相对 schemaDir 解析（镜像 Prisma 语义）", () => {
  assert.equal(
    resolveSqliteUrl("file:./data/db/a.db", "/proj/prisma"),
    "/proj/prisma/data/db/a.db",
  );
  assert.equal(resolveSqliteUrl("file:../data/db/a.db", "/proj/prisma"), "/proj/data/db/a.db");
});

test("resolveSqliteUrl：绝对路径原样、query 剥离、空值抛错", () => {
  assert.equal(resolveSqliteUrl("file:/abs/a.db", "/proj/prisma"), "/abs/a.db");
  assert.equal(
    resolveSqliteUrl("file:./a.db?connection_limit=1", "/proj/prisma"),
    "/proj/prisma/a.db",
  );
  assert.throws(() => resolveSqliteUrl("file:", "/proj/prisma"));
});

test("timestampSlug：YYYYMMDD-HHmmss 格式", () => {
  assert.match(timestampSlug(new Date()), /^\d{8}-\d{6}$/);
});
