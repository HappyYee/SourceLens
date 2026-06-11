// npm run backup —— SQLite 热备：VACUUM INTO 生成紧凑快照 + 完整性校验 + 行数比对。
// dev server 运行中也安全（只取读事务，源库零修改）。绝不自动删除旧备份。
// 经 npm script 的 --env-file=.env 注入 DATABASE_URL；本代码不读 .env 文件本身。
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveSqliteUrl, timestampSlug } from "../src/lib/db-file.ts";
import { getDataDir } from "../src/lib/storage.ts";

const TABLES = ["Room", "RoomType", "SourceBinding", "Item", "AuthProfile"] as const;

function tableCounts(db: DatabaseSync): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of TABLES) {
    out[t] = Number((db.prepare(`SELECT count(*) AS c FROM "${t}"`).get() as { c: number }).c);
  }
  return out;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("缺少 DATABASE_URL。请通过 npm run backup 调用（会经 --env-file=.env 注入）。");
  process.exit(1);
}

const dbPath = resolveSqliteUrl(url, resolve(process.cwd(), "prisma"));
const backupsDir = join(getDataDir(), "backups");
mkdirSync(backupsDir, { recursive: true });
const dest = join(backupsDir, `sourcelens-${timestampSlug(new Date())}.db`);

// 只读打开源库：物理上保证备份过程不可能写坏档案。
const src = new DatabaseSync(dbPath, { readOnly: true });
try {
  src.exec(`VACUUM INTO '${dest.replaceAll("'", "''")}'`);
  const srcCounts = tableCounts(src);

  const snap = new DatabaseSync(dest, { readOnly: true });
  try {
    const integrity = (snap.prepare("PRAGMA integrity_check").get() as {
      integrity_check: string;
    }).integrity_check;
    const snapCounts = tableCounts(snap);
    const mismatches = TABLES.filter((t) => srcCounts[t] !== snapCounts[t]);

    if (integrity !== "ok" || mismatches.length > 0) {
      console.error(`备份校验失败：integrity=${integrity}，行数不一致表=${mismatches.join(",") || "无"}`);
      console.error(`快照已写入但不可信：${dest}（请删除后重试）`);
      process.exit(1);
    }

    const size = (statSync(dest).size / 1024 / 1024).toFixed(2);
    const all = readdirSync(backupsDir).filter((f) => f.endsWith(".db"));
    const total = all.reduce((s, f) => s + statSync(join(backupsDir, f)).size, 0);
    console.log(`✅ 备份完成：${dest}（${size} MB）`);
    console.log(
      `   integrity=ok · 行数一致：${TABLES.map((t) => `${t}=${snapCounts[t]}`).join(" ")}`,
    );
    console.log(
      `   现有备份 ${all.length} 个，共 ${(total / 1024 / 1024).toFixed(2)} MB（不自动清理，可手动删除旧文件）`,
    );
    console.log(`   还原方法：停掉 dev → 用该快照覆盖 ${dbPath} → 重启。`);
  } finally {
    snap.close();
  }
} finally {
  src.close();
}
