// Phase 2 验收：解析→标准化的核心逻辑 + 各平台 URL 构造。直跑真实源码。
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEntry,
  parseDuration,
  pickThumbnail,
  stripHtml,
  type RawEntry,
} from "../src/lib/normalize.ts";
import { buildArxivUrl } from "../src/lib/connectors/arxiv.ts";
import { buildGithubUrl } from "../src/lib/connectors/github.ts";
import { buildYoutubeUrl } from "../src/lib/connectors/youtube.ts";

test("parseDuration: HH:MM:SS / MM:SS / 纯秒", () => {
  assert.equal(parseDuration("1:02:03"), 3723);
  assert.equal(parseDuration("08:55"), 535);
  assert.equal(parseDuration("1:12:40"), 4360);
  assert.equal(parseDuration("3600"), 3600);
  assert.equal(parseDuration(90), 90);
  assert.equal(parseDuration("0"), null);
  assert.equal(parseDuration(""), null);
  assert.equal(parseDuration("abc"), null);
  assert.equal(parseDuration(null), null);
});

test("stripHtml: 去标签 + 实体解码 + 折叠空白", () => {
  assert.equal(stripHtml("<p>Hi&nbsp;&amp; <b>bye</b></p>"), "Hi & bye");
  assert.equal(stripHtml(""), "");
  assert.equal(stripHtml(null), "");
});

test("pickThumbnail: media:thumbnail / media:content / enclosure(image)", () => {
  assert.equal(
    pickThumbnail({ "media:thumbnail": { $: { url: "https://i/x.jpg" } } }),
    "https://i/x.jpg",
  );
  assert.equal(
    pickThumbnail({ "media:thumbnail": [{ $: { url: "https://i/a.jpg" } }] }),
    "https://i/a.jpg",
  );
  assert.equal(
    pickThumbnail({ enclosure: { url: "https://i/p.png", type: "image/png" } }),
    "https://i/p.png",
  );
  assert.equal(
    pickThumbnail({ enclosure: { url: "https://a/audio.mp3", type: "audio/mpeg" } }),
    null,
  );
  assert.equal(pickThumbnail({}), null);
});

test("normalizeEntry: RSS 博客条目", () => {
  const e: RawEntry = {
    title: "  年度技术路线说明  ",
    link: "https://blog.example.com/post-1",
    guid: "guid-post-1",
    isoDate: "2026-06-07T18:02:00.000Z",
    contentSnippet: "这是简介。",
  };
  const vm = normalizeEntry(e)!;
  assert.equal(vm.externalId, "guid-post-1");
  assert.equal(vm.title, "年度技术路线说明"); // trim
  assert.equal(vm.url, "https://blog.example.com/post-1");
  assert.equal(vm.publishedAt.toISOString(), "2026-06-07T18:02:00.000Z");
  assert.equal(vm.excerpt, "这是简介。");
  assert.equal(vm.durationSec, null);
});

test("normalizeEntry: YouTube（有缩略图，无时长）", () => {
  const e: RawEntry = {
    title: "发射任务全程回放",
    link: "https://youtube.com/watch?v=abc",
    "yt:videoId": "abc",
    isoDate: "2026-06-07T09:10:00.000Z",
    "media:thumbnail": { $: { url: "https://i.ytimg.com/abc.jpg" } },
  };
  const vm = normalizeEntry(e)!;
  assert.equal(vm.thumbnailUrl, "https://i.ytimg.com/abc.jpg");
  assert.equal(vm.durationSec, null); // YouTube RSS 取不到时长
});

test("normalizeEntry: 播客（itunes:duration 可取）", () => {
  const e: RawEntry = {
    title: "第 112 期",
    link: "https://pod.example.com/112",
    guid: "pod-112",
    pubDate: "Sat, 07 Jun 2026 21:00:00 GMT",
    "itunes:duration": "1:12:40",
    enclosure: { url: "https://pod.example.com/112.mp3", type: "audio/mpeg" },
  };
  const vm = normalizeEntry(e, { isPodcast: true })!;
  assert.equal(vm.durationSec, 4360);
  assert.ok(!Number.isNaN(+vm.publishedAt));
});

test("normalizeEntry: externalId 回退 link；缺失则丢弃；同 guid 稳定（去重基础）", () => {
  const noGuid: RawEntry = { link: "https://x/y", isoDate: "2026-06-01T00:00:00.000Z" };
  assert.equal(normalizeEntry(noGuid)!.externalId, "https://x/y");
  assert.equal(normalizeEntry({ title: "无 id 无 link" }), null);
  // 同一 guid 的两次解析（其它字段不同）→ externalId 一致 → DB 唯一约束去重
  const a = normalizeEntry({ guid: "same", link: "https://x/1", title: "v1" })!;
  const b = normalizeEntry({ guid: "same", link: "https://x/2", title: "v2" })!;
  assert.equal(a.externalId, b.externalId);
});

test("buildArxivUrl", () => {
  const u = buildArxivUrl("cat:cs.AI");
  assert.match(u, /search_query=cat:cs\.AI/);
  assert.match(u, /sortBy=submittedDate&sortOrder=descending/);
  assert.match(buildArxivUrl("world models"), /search_query=world\+models/);
});

test("buildGithubUrl", () => {
  assert.equal(buildGithubUrl("openai/openai-python"), "https://github.com/openai/openai-python/releases.atom");
  assert.equal(buildGithubUrl("github.com/a/b/"), "https://github.com/a/b/releases.atom");
  assert.equal(buildGithubUrl("https://github.com/a/b/tags.atom"), "https://github.com/a/b/tags.atom");
});

test("buildYoutubeUrl", () => {
  assert.equal(
    buildYoutubeUrl("UCabc123"),
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCabc123",
  );
  assert.equal(
    buildYoutubeUrl("https://www.youtube.com/feeds/videos.xml?channel_id=UCx"),
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCx",
  );
});
