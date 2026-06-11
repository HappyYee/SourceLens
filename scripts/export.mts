// npm run export —— 档案 JSON 导出：Room 树 + RoomType + SourceBinding + Item 全量。
// AuthProfile 整表排除（profileDir 本机路径 / proxyUrl 可能含凭证，不属于档案）。
// 只读打开数据库；经 npm script 的 --env-file=.env 注入 DATABASE_URL。
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveSqliteUrl, timestampSlug } from "../src/lib/db-file.ts";
import { buildExportPayload } from "../src/lib/export-data.ts";
import { getDataDir } from "../src/lib/storage.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("缺少 DATABASE_URL。请通过 npm run export 调用（会经 --env-file=.env 注入）。");
  process.exit(1);
}

const dbPath = resolveSqliteUrl(url, resolve(process.cwd(), "prisma"));
const db = new DatabaseSync(dbPath, { readOnly: true });
try {
  const all = (t: string) => db.prepare(`SELECT * FROM "${t}"`).all() as unknown[];
  let migration: string | null = null;
  try {
    const row = db
      .prepare(
        `SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 1`,
      )
      .get() as { migration_name?: string } | undefined;
    migration = row?.migration_name ?? null;
  } catch {
    // 旧库无迁移表时容忍缺失
  }

  const payload = buildExportPayload(
    {
      rooms: all("Room"),
      roomTypes: all("RoomType"),
      bindings: all("SourceBinding"),
      items: all("Item"),
    },
    { exportedAt: new Date().toISOString(), migration },
  );

  const json = JSON.stringify(payload);
  // 敏感字段绊网：只扫 bindings（唯一与登录态相邻的表）。不扫 items——raw 是用户内容，
  // 正文恰好包含这些字样属合法档案，不应误杀导出。binding.authProfileId 是无害 id 引用。
  const bindingsJson = JSON.stringify(payload.bindings);
  for (const needle of ['"profileDir"', '"proxyUrl"', '"proxyMode"', '"refreshRegion"']) {
    if (bindingsJson.includes(needle)) {
      console.error(`导出中止：bindings 中发现不应出现的敏感字段 ${needle}`);
      process.exit(1);
    }
  }

  const exportsDir = join(getDataDir(), "exports");
  mkdirSync(exportsDir, { recursive: true });
  const dest = join(exportsDir, `sourcelens-export-${timestampSlug(new Date())}.json`);
  writeFileSync(dest, json);
  const size = (statSync(dest).size / 1024 / 1024).toFixed(2);
  const c = payload.meta.counts;
  console.log(`✅ 导出完成：${dest}（${size} MB）`);
  console.log(
    `   rooms=${c.rooms} roomTypes=${c.roomTypes} bindings=${c.bindings} items=${c.items} · schema=${migration ?? "未知"}`,
  );
} finally {
  db.close();
}
