// YouTube 纯逻辑：videoId 抽取 + ISO-8601 时长解析（API 调用需在 Mac 上联网实测）。
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlaylistTagAssignments,
  collectVideoIds,
  extractChannelId,
  extractHandle,
  extractVideoId,
  parseISO8601Duration,
  resolveBackfillLimit,
  uploadsPlaylistFromChannelId,
  youtubeKindFromDuration,
  youtubeRssUrl,
} from "../src/lib/connectors/youtube.ts";

// 构造分页器：pageSizes 描述每页条数，token 用页序号字符串串联。
function makePager(pageSizes: number[]) {
  return async (token: string | undefined) => {
    const idx = token == null ? 0 : Number(token);
    const size = pageSizes[idx] ?? 0;
    const ids = Array.from({ length: size }, (_, i) => `p${idx}-${i}`);
    const nextPageToken = idx + 1 < pageSizes.length ? String(idx + 1) : undefined;
    return { ids, nextPageToken };
  };
}

test("extractVideoId: watch/youtu.be/shorts/guid/裸 id", () => {
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("yt:video:dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("https://www.youtube.com/shorts/abcdefghijk"), "abcdefghijk");
  assert.equal(extractVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractVideoId("https://example.com/x"), null);
  assert.equal(extractVideoId(""), null);
});

test("parseISO8601Duration: PT / 天 / 边界", () => {
  assert.equal(parseISO8601Duration("PT1H2M3S"), 3723);
  assert.equal(parseISO8601Duration("PT42M18S"), 2538);
  assert.equal(parseISO8601Duration("PT8M55S"), 535);
  assert.equal(parseISO8601Duration("PT59S"), 59);
  assert.equal(parseISO8601Duration("P1DT2H"), 93600);
  assert.equal(parseISO8601Duration("PT0S"), null);
  assert.equal(parseISO8601Duration("garbage"), null);
  assert.equal(parseISO8601Duration(null), null);
});

test("extractChannelId: UC id / channel URL（其它 null）", () => {
  assert.equal(extractChannelId("UC_x5XG1OV2P6uZZ5FSM9Ttw"), "UC_x5XG1OV2P6uZZ5FSM9Ttw");
  assert.equal(
    extractChannelId("https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw"),
    "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  );
  assert.equal(
    extractChannelId("https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw"),
    "UC_x5XG1OV2P6uZZ5FSM9Ttw",
  );
  assert.equal(extractChannelId("https://www.youtube.com/@henren778"), null);
  assert.equal(extractChannelId("garbage"), null);
});

test("extractHandle: @handle / handle URL（UC id null）", () => {
  assert.equal(extractHandle("@henren778"), "henren778");
  assert.equal(extractHandle("https://www.youtube.com/@henren778"), "henren778");
  assert.equal(extractHandle("https://www.youtube.com/@henren778/videos"), "henren778");
  assert.equal(extractHandle("UC_x5XG1OV2P6uZZ5FSM9Ttw"), null);
});

test("youtubeRssUrl", () => {
  assert.equal(
    youtubeRssUrl("UCabc"),
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCabc",
  );
});

test("collectVideoIds: 遇 nextPageToken 继续；limit 停在对应数量；无下一页则 hasMore=false", async () => {
  let r = await collectVideoIds(makePager([50, 50, 50]), 100);
  assert.equal(r.ids.length, 100);
  assert.equal(r.pageCount, 2);
  assert.equal(r.hasMore, true);

  r = await collectVideoIds(makePager([50, 50, 50]), 50);
  assert.equal(r.ids.length, 50);
  assert.equal(r.pageCount, 1);
  assert.equal(r.hasMore, true);

  r = await collectVideoIds(makePager([50, 50, 50]), 300);
  assert.equal(r.ids.length, 150); // 不足 300，收全部
  assert.equal(r.hasMore, false);

  r = await collectVideoIds(makePager([50, 50, 50]), Number.POSITIVE_INFINITY);
  assert.equal(r.ids.length, 150);
  assert.equal(r.pageCount, 3);
  assert.equal(r.hasMore, false);

  // 跨页继续抓、顺序与唯一性
  r = await collectVideoIds(makePager([2, 2]), 10);
  assert.deepEqual(r.ids, ["p0-0", "p0-1", "p1-0", "p1-1"]);
  assert.equal(r.hasMore, false);
});

test("youtubeKindFromDuration: <=60 short，>60 video，缺失/<=0 unknown", () => {
  assert.equal(youtubeKindFromDuration(45), "short");
  assert.equal(youtubeKindFromDuration(60), "short");
  assert.equal(youtubeKindFromDuration(61), "video");
  assert.equal(youtubeKindFromDuration(3600), "video");
  assert.equal(youtubeKindFromDuration(null), "unknown");
  assert.equal(youtubeKindFromDuration(undefined), "unknown");
  assert.equal(youtubeKindFromDuration(0), "unknown");
});

test("buildPlaylistTagAssignments: 只标已导入；多标签；非导入不污染；不在列表则清空", () => {
  const tagMap = new Map<string, string[]>([
    ["v1", ["宏观经济", "美股入门"]],
    ["v2", ["AI工具"]],
    ["vX", ["外部视频"]], // 非本频道导入的视频
  ]);
  const imported = ["v1", "v2", "v3"]; // v3 已导入但不在任何播放列表
  const a = buildPlaylistTagAssignments(imported, tagMap);
  assert.deepEqual(a.get("v1"), ["宏观经济", "美股入门"]); // 一个视频多标签
  assert.deepEqual(a.get("v2"), ["AI工具"]);
  assert.deepEqual(a.get("v3"), []); // 不在播放列表 → 清空
  assert.equal(a.has("vX"), false); // 非导入 → 不出现，不污染
  assert.equal(a.size, 3);
});

test("resolveBackfillLimit / uploadsPlaylistFromChannelId", () => {
  assert.equal(resolveBackfillLimit("all"), Number.POSITIVE_INFINITY);
  assert.equal(resolveBackfillLimit(50), 50);
  assert.equal(resolveBackfillLimit("100"), 100);
  assert.equal(resolveBackfillLimit("garbage"), 100);
  assert.equal(resolveBackfillLimit(0), 100);
  assert.equal(
    uploadsPlaylistFromChannelId("UC_x5XG1OV2P6uZZ5FSM9Ttw"),
    "UU_x5XG1OV2P6uZZ5FSM9Ttw",
  );
  assert.equal(uploadsPlaylistFromChannelId("garbage"), null);
});
