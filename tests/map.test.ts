import test from "node:test";
import assert from "node:assert/strict";
import {
  distinctPlatforms,
  toItemVM,
  toRoomVM,
} from "../src/lib/map.ts";

test("distinctPlatforms: 去重保序", () => {
  assert.deepEqual(
    distinctPlatforms([{ platform: "x" }, { platform: "rss" }, { platform: "x" }]),
    ["x", "rss"],
  );
});

test("toItemVM: Date→ISO，字段透传", () => {
  const d = new Date("2026-06-01T08:00:00.000Z");
  const vm = toItemVM({
    id: "i1",
    platform: "youtube",
    title: "T",
    aiTitle: null,
    excerpt: "e",
    url: "u",
    thumbnailUrl: "https://i0.hdslb.com/bfs/archive/cover.jpg",
    durationSec: 60,
    author: null,
    publishedAt: d,
  });
  assert.equal(vm.publishedAt, d.toISOString());
  assert.equal(vm.platform, "youtube");
  assert.equal(vm.thumbnailUrl, "https://i0.hdslb.com/bfs/archive/cover.jpg");
  assert.equal(vm.durationSec, 60);
  // 已是字符串时原样保留
  assert.equal(
    toItemVM({
      id: "i2",
      platform: "x",
      title: null,
      aiTitle: null,
      excerpt: null,
      url: "#",
      thumbnailUrl: null,
      durationSec: null,
      author: null,
      publishedAt: "2026-06-01T00:00:00.000Z",
    }).publishedAt,
    "2026-06-01T00:00:00.000Z",
  );
});

test("toRoomVM: nodeKind/type 透传 + bindings 去重 + items 映射", () => {
  const r = toRoomVM({
    id: "r",
    name: "R",
    nodeKind: "room",
    type: "person",
    importance: 4,
    bindings: [{ platform: "x" }, { platform: "x" }, { platform: "rss" }],
    items: [
      {
        id: "i",
        platform: "x",
        title: null,
        aiTitle: "a",
        excerpt: null,
        url: "#",
        thumbnailUrl: null,
        durationSec: null,
        author: null,
        publishedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  });
  assert.equal(r.nodeKind, "room");
  assert.equal(r.type, "person");
  assert.deepEqual(r.bindings, ["x", "rss"]);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].aiTitle, "a");
});
