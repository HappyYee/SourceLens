// Item 写入数据构造（Phase 3a）：lastSeenAt 写入 + customTitle/播放列表标签永不出现。
import test from "node:test";
import assert from "node:assert/strict";
import { buildItemCreateData, buildItemUpdateData, jsonOrNull } from "../src/lib/item-data.ts";
import type { NormalizedItem } from "../src/lib/normalize.ts";

const binding = { id: "b1", roomId: "r1", platform: "x" };
const seenAt = new Date("2026-06-11T00:00:00.000Z");

function baseItem(over: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    externalId: "e1",
    title: null,
    excerpt: "正文摘要",
    url: "https://x.com/u/status/1",
    thumbnailUrl: null,
    durationSec: null,
    author: "作者",
    publishedAt: new Date("2026-06-10T00:00:00.000Z"),
    ...over,
  };
}

test("buildItemCreateData：写入 lastSeenAt，绝不出现 customTitle / youtubePlaylistTags", () => {
  const d = buildItemCreateData(binding, baseItem(), "AI 标题", seenAt);
  assert.equal(d.lastSeenAt, seenAt);
  assert.equal(d.roomId, "r1");
  assert.equal(d.aiTitle, "AI 标题");
  assert.equal(d.titleSource, "rule"); // 无原始标题、有摘要 → rule
  assert.ok(!("customTitle" in d));
  assert.ok(!("youtubePlaylistTags" in d));
  assert.ok(!("availability" in d)); // 档案状态归 metadata checker（3b），刷新无权写
});

test("buildItemUpdateData：写入 lastSeenAt，只更新有值字段，缺失字段不清空", () => {
  const d = buildItemUpdateData(binding, baseItem({ excerpt: null, author: null }), null, seenAt);
  assert.equal(d.lastSeenAt, seenAt);
  assert.equal(d.bindingId, "b1");
  assert.ok(!("title" in d)); // null → 不写，避免清空既有值
  assert.ok(!("excerpt" in d));
  assert.ok(!("author" in d));
  assert.ok(!("customTitle" in d));
  assert.ok(!("youtubePlaylistTags" in d));
});

test("buildItemUpdateData：有值字段正常透传（含 videoKind 双写场景）", () => {
  const d = buildItemUpdateData(
    binding,
    baseItem({ youtubeKind: "short", videoKind: "short", platformTags: ["Thread"] }),
    null,
    seenAt,
  );
  assert.equal(d.youtubeKind, "short");
  assert.equal(d.videoKind, "short");
  assert.equal(d.platformTags, JSON.stringify(["Thread"]));
});

test("jsonOrNull：空数组/null → null，非空正常序列化", () => {
  assert.equal(jsonOrNull(null), null);
  assert.equal(jsonOrNull(undefined), null);
  assert.equal(jsonOrNull([]), null);
  assert.equal(jsonOrNull(["a"]), '["a"]');
  assert.equal(jsonOrNull({ k: 1 }), '{"k":1}');
});
