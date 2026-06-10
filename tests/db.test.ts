// 用 node:sqlite 复刻 schema.prisma 的语义，验证 Prisma 层依赖的数据行为：
// 时间线归并、(roomId,externalId) 去重、删 Room 级联、删 Source 保留 item(置空)、父级置空、今日计数。
// 运行需 --experimental-sqlite。
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE Room (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      nodeKind TEXT NOT NULL DEFAULT 'room', type TEXT,
      importance INTEGER NOT NULL DEFAULT 3, parentId TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (parentId) REFERENCES Room(id) ON DELETE SET NULL
    );
    CREATE TABLE SourceBinding (
      id TEXT PRIMARY KEY, roomId TEXT NOT NULL, platform TEXT NOT NULL,
      feedUrl TEXT, query TEXT, label TEXT, enabled INTEGER NOT NULL DEFAULT 1,
      intervalMin INTEGER NOT NULL DEFAULT 60, lastFetchedAt TEXT, lastError TEXT, createdAt TEXT,
      FOREIGN KEY (roomId) REFERENCES Room(id) ON DELETE CASCADE
    );
    CREATE TABLE Item (
      id TEXT PRIMARY KEY, bindingId TEXT, roomId TEXT NOT NULL, platform TEXT NOT NULL,
      externalId TEXT NOT NULL, title TEXT, aiTitle TEXT, customTitle TEXT, titleSource TEXT,
      excerpt TEXT, url TEXT NOT NULL, thumbnailUrl TEXT, durationSec INTEGER, author TEXT,
      publishedAt TEXT NOT NULL, fetchedAt TEXT, raw TEXT,
      youtubeKind TEXT, youtubePlaylistTags TEXT,
      FOREIGN KEY (bindingId) REFERENCES SourceBinding(id) ON DELETE SET NULL,
      FOREIGN KEY (roomId) REFERENCES Room(id) ON DELETE CASCADE,
      UNIQUE (roomId, externalId)
    );
    CREATE INDEX idx_item_room_pub ON Item(roomId, publishedAt);
  `);
  return db;
}

function addRoom(db: DatabaseSync, id: string, opts: Partial<{ type: string; importance: number; parentId: string | null; sortOrder: number }> = {}) {
  db.prepare("INSERT INTO Room(id,name,type,importance,parentId,sortOrder) VALUES(?,?,?,?,?,?)").run(
    id, id, opts.type ?? "person", opts.importance ?? 3, opts.parentId ?? null, opts.sortOrder ?? 0,
  );
}
function addBinding(db: DatabaseSync, id: string, roomId: string, platform: string) {
  db.prepare("INSERT INTO SourceBinding(id,roomId,platform) VALUES(?,?,?)").run(id, roomId, platform);
}
function addItem(db: DatabaseSync, id: string, bindingId: string | null, roomId: string, platform: string, externalId: string, publishedAt: string) {
  db.prepare("INSERT INTO Item(id,bindingId,roomId,platform,externalId,url,publishedAt) VALUES(?,?,?,?,?,?,?)").run(
    id, bindingId, roomId, platform, externalId, "#", publishedAt,
  );
}

test("时间线：多 binding 的 Item 按 publishedAt 降序归并", () => {
  const db = freshDb();
  addRoom(db, "elon", { importance: 5 });
  addBinding(db, "b-x", "elon", "x");
  addBinding(db, "b-yt", "elon", "youtube");
  addItem(db, "i1", "b-x", "elon", "x", "x1", "2026-06-07T10:00:00.000Z");
  addItem(db, "i2", "b-yt", "elon", "youtube", "y1", "2026-06-07T14:00:00.000Z");
  addItem(db, "i3", "b-x", "elon", "x", "x2", "2026-06-06T23:00:00.000Z");
  const rows = db.prepare("SELECT id FROM Item WHERE roomId=? ORDER BY publishedAt DESC").all("elon") as { id: string }[];
  assert.deepEqual(rows.map((r) => r.id), ["i2", "i1", "i3"]);
  db.close();
});

test("去重：同一 Room 内同 externalId 不重复；跨 Room 同 externalId 可共存", () => {
  const db = freshDb();
  addRoom(db, "r");
  addBinding(db, "b", "r", "youtube");
  addItem(db, "i1", "b", "r", "youtube", "vid-1", "2026-06-07T10:00:00.000Z");
  // 同 Room 同 externalId：普通插入抛错
  assert.throws(() => addItem(db, "i2", "b", "r", "youtube", "vid-1", "2026-06-07T10:00:00.000Z"));
  // INSERT OR IGNORE → 仍 1 条
  db.prepare("INSERT OR IGNORE INTO Item(id,bindingId,roomId,platform,externalId,url,publishedAt) VALUES(?,?,?,?,?,?,?)")
    .run("i3", "b", "r", "youtube", "vid-1", "#", "2026-06-07T10:00:00.000Z");
  assert.equal((db.prepare("SELECT COUNT(*) c FROM Item WHERE roomId='r'").get() as { c: number }).c, 1);
  // 同 Room 不同 binding 同 externalId：也冲突（按 Room 去重）
  addBinding(db, "b2", "r", "x");
  assert.throws(() => addItem(db, "i4", "b2", "r", "x", "vid-1", "2026-06-07T10:00:00.000Z"));
  // 不同 Room 同 externalId：可共存（Room 之间独立）
  addRoom(db, "r2");
  addBinding(db, "b3", "r2", "youtube");
  addItem(db, "i5", "b3", "r2", "youtube", "vid-1", "2026-06-07T10:00:00.000Z");
  assert.equal((db.prepare("SELECT COUNT(*) c FROM Item").get() as { c: number }).c, 2);
  db.close();
});

test("删除 Room：连带删除其 bindings 与 items", () => {
  const db = freshDb();
  addRoom(db, "r");
  addBinding(db, "b", "r", "rss");
  addItem(db, "i", "b", "r", "rss", "g1", "2026-06-07T10:00:00.000Z");
  db.prepare("DELETE FROM Room WHERE id='r'").run();
  assert.equal((db.prepare("SELECT COUNT(*) c FROM SourceBinding").get() as { c: number }).c, 0);
  assert.equal((db.prepare("SELECT COUNT(*) c FROM Item").get() as { c: number }).c, 0);
  db.close();
});

test("删除 Source(binding)：历史 item 保留为档案，bindingId 置空", () => {
  const db = freshDb();
  addRoom(db, "r");
  addBinding(db, "b1", "r", "youtube");
  addItem(db, "i1", "b1", "r", "youtube", "vid-1", "2026-06-07T10:00:00.000Z");
  db.prepare("DELETE FROM SourceBinding WHERE id='b1'").run();
  const row = db.prepare("SELECT id, bindingId FROM Item WHERE id='i1'").get() as { id: string; bindingId: string | null };
  assert.ok(row, "item 仍在（档案）");
  assert.equal(row.bindingId, null, "bindingId 被置空（不级联删除）");
  db.close();
});

test("嵌套：删除父 Room 时子 Room 的 parentId 置空（子 room 保留）", () => {
  const db = freshDb();
  addRoom(db, "folder", { type: "folder" });
  addRoom(db, "child", { parentId: "folder" });
  db.prepare("DELETE FROM Room WHERE id='folder'").run();
  const child = db.prepare("SELECT parentId FROM Room WHERE id='child'").get() as { parentId: string | null };
  assert.equal(child.parentId, null);
  db.close();
});

test("更新 youtubeKind / 播放列表标签不覆盖 customTitle", () => {
  const db = freshDb();
  addRoom(db, "r");
  addBinding(db, "b", "r", "youtube");
  // 用户已手动改过标题
  db.prepare(
    "INSERT INTO Item(id,bindingId,roomId,platform,externalId,url,publishedAt,customTitle,titleSource) VALUES(?,?,?,?,?,?,?,?,?)",
  ).run("i1", "b", "r", "youtube", "vid-1", "#", "2026-06-07T10:00:00.000Z", "我的标题", "custom");
  // 刷新/回溯：只更新 youtubeKind
  db.prepare("UPDATE Item SET youtubeKind='short' WHERE id='i1'").run();
  // 标签同步：只更新 youtubePlaylistTags
  db.prepare("UPDATE Item SET youtubePlaylistTags=? WHERE id='i1'").run(JSON.stringify(["宏观经济"]));
  const row = db
    .prepare("SELECT customTitle, youtubeKind, youtubePlaylistTags FROM Item WHERE id='i1'")
    .get() as { customTitle: string; youtubeKind: string; youtubePlaylistTags: string };
  assert.equal(row.customTitle, "我的标题"); // customTitle 不被覆盖
  assert.equal(row.youtubeKind, "short");
  assert.equal(row.youtubePlaylistTags, JSON.stringify(["宏观经济"]));
  db.close();
});

test("迁移：旧 type='folder'→nodeKind=folder+type=null；其余→nodeKind=room+type=原值", () => {
  const db = freshDb();
  db.prepare("INSERT INTO Room(id,name,nodeKind,type,importance,sortOrder) VALUES(?,?,?,?,?,?)").run("f", "乃木坂46", "room", "folder", 3, 0);
  db.prepare("INSERT INTO Room(id,name,nodeKind,type,importance,sortOrder) VALUES(?,?,?,?,?,?)").run("r", "Anthropic", "room", "company", 5, 0);
  // 迁移脚本的等价 SQL
  db.prepare("UPDATE Room SET nodeKind='folder', type=NULL WHERE type='folder'").run();
  const f = db.prepare("SELECT nodeKind, type FROM Room WHERE id='f'").get() as { nodeKind: string; type: string | null };
  const r = db.prepare("SELECT nodeKind, type FROM Room WHERE id='r'").get() as { nodeKind: string; type: string | null };
  assert.equal(f.nodeKind, "folder");
  assert.equal(f.type, null);
  assert.equal(r.nodeKind, "room");
  assert.equal(r.type, "company");
  db.close();
});

test("今日计数：publishedAt >= 今日零点", () => {
  const db = freshDb();
  addRoom(db, "r");
  addBinding(db, "b", "r", "rss");
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  addItem(db, "i1", "b", "r", "rss", "g1", new Date(start.getTime() + 3_600_000).toISOString());
  addItem(db, "i2", "b", "r", "rss", "g2", new Date(start.getTime() - 3_600_000).toISOString());
  const c = db.prepare("SELECT COUNT(*) c FROM Item WHERE roomId=? AND publishedAt >= ?").get("r", start.toISOString()) as { c: number };
  assert.equal(c.c, 1);
  db.close();
});
