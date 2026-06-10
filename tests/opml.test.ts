// Phase 4 验收：OPML 解析（feed + 文件夹归属 + 实体解码）。
import test from "node:test";
import assert from "node:assert/strict";
import { parseOpml } from "../src/lib/opml.ts";

const SAMPLE = `<?xml version="1.0"?>
<opml version="2.0"><head><title>subs</title></head><body>
  <outline text="Tech" title="Tech">
    <outline type="rss" text="Blog A" title="Blog A" xmlUrl="https://a.com/feed" htmlUrl="https://a.com"/>
    <outline type="rss" text="Blog B" xmlUrl="https://b.com/rss"/>
  </outline>
  <outline type="rss" text="Top &amp; Level" xmlUrl="https://c.com/atom"/>
</body></opml>`;

test("parseOpml: 解析 feed + 文件夹归属 + 实体解码", () => {
  const feeds = parseOpml(SAMPLE);
  assert.equal(feeds.length, 3);
  assert.deepEqual(feeds[0], { folder: "Tech", title: "Blog A", xmlUrl: "https://a.com/feed" });
  assert.deepEqual(feeds[1], { folder: "Tech", title: "Blog B", xmlUrl: "https://b.com/rss" });
  assert.deepEqual(feeds[2], { folder: null, title: "Top & Level", xmlUrl: "https://c.com/atom" });
});

test("parseOpml: 空 / 无 feed → []", () => {
  assert.deepEqual(parseOpml("<opml><body></body></opml>"), []);
  assert.deepEqual(parseOpml(""), []);
});

test("parseOpml: 文件夹结束后回到顶层", () => {
  const xml = `<body>
    <outline title="F1"><outline xmlUrl="u1" title="a"/></outline>
    <outline xmlUrl="u2" title="b"/>
  </body>`;
  assert.deepEqual(
    parseOpml(xml).map((f) => f.folder),
    ["F1", null],
  );
});
