// X 纯逻辑：handle 解析、UserTweets 解析、postKind 分类、默认过滤 replies/reposts、映射去重键。
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseXInput,
  parseUserTweets,
  classifyPostKind,
  filterTweets,
  mapTweet,
  normalizeXStatusUrl,
  tweetsToItems,
  type RawTweet,
} from "../src/lib/connectors/xpost.ts";

/* ----------------------------- handle 解析 ----------------------------- */

test("parseXInput：@handle / 裸 handle", () => {
  assert.equal(parseXInput("@elonmusk"), "elonmusk");
  assert.equal(parseXInput("elonmusk"), "elonmusk");
  assert.equal(parseXInput("  @NASA "), "nasa");
});

test("parseXInput：x.com / twitter.com 链接（含 /status）", () => {
  assert.equal(parseXInput("https://x.com/elonmusk"), "elonmusk");
  assert.equal(parseXInput("https://twitter.com/NASA/status/123"), "nasa");
});

test("parseXInput：保留路径 / 非法 → null", () => {
  assert.equal(parseXInput("https://x.com/home"), null);
  assert.equal(parseXInput("https://x.com/search?q=a"), null);
  assert.equal(parseXInput(""), null);
  assert.equal(parseXInput("这不是用户名"), null);
});

/* ----------------------------- 构造 UserTweets 夹具 ----------------------------- */

const ALICE = { user_results: { result: { legacy: { name: "Alice", screen_name: "alice" } } } };
const BOB = { user_results: { result: { legacy: { name: "Bob", screen_name: "bob" } } } };
const CORE_ALICE = {
  user_results: { result: { legacy: {}, core: { name: "Alice Core", screen_name: "alicecore" } } },
};
const CORE_BOB = {
  user_results: { result: { legacy: {}, core: { name: "Bob Core", screen_name: "corebob" } } },
};

function tweetEntry(id: string, legacy: Record<string, unknown>, core = ALICE) {
  return {
    entryId: `tweet-${id}`,
    content: {
      itemContent: {
        tweet_results: { result: { rest_id: id, legacy: { id_str: id, ...legacy }, core } },
      },
    },
  };
}

const payload = {
  data: {
    user: {
      result: {
        timeline_v2: {
          timeline: {
            instructions: [
              {
                type: "TimelineAddEntries",
                entries: [
                  tweetEntry("1", { full_text: "纯文字推文", created_at: "Wed Oct 10 20:19:24 +0000 2018" }),
                  tweetEntry("2", {
                    full_text: "带图",
                    extended_entities: { media: [{ type: "photo", media_url_https: "https://pbs/img.jpg" }] },
                  }),
                  tweetEntry("3", {
                    full_text: "带视频",
                    extended_entities: { media: [{ type: "video", media_url_https: "https://pbs/v.jpg" }] },
                  }),
                  tweetEntry("4", {
                    full_text: "带外链",
                    entities: { urls: [{ expanded_url: "https://example.com/post", display_url: "example.com" }] },
                  }),
                  tweetEntry("5", {
                    full_text: "引用别人",
                    is_quote_status: true,
                  }, ALICE),
                  tweetEntry("6", { full_text: "这是回复", in_reply_to_status_id_str: "999" }),
                  tweetEntry("7", { full_text: "RT", retweeted_status_result: { result: { rest_id: "70" } } }),
                  { entryId: "cursor-bottom-XYZ", content: { value: "abc", cursorType: "Bottom" } }, // 非推文，忽略
                ],
              },
            ],
          },
        },
      },
    },
  },
};
// 给 5 号补上 quoted_status_result（引用对象）
(payload.data.user.result.timeline_v2.timeline.instructions[0].entries[4] as any).content.itemContent.tweet_results.result.quoted_status_result = {
  result: { rest_id: "50", legacy: { id_str: "50", full_text: "被引用的原文" }, core: BOB },
};

/* ----------------------------- 解析 + 分类 ----------------------------- */

test("parseUserTweets：抽出全部推文，忽略 cursor", () => {
  const tweets = parseUserTweets(payload);
  const ids = tweets.map((t) => t.id).sort();
  assert.deepEqual(ids, ["1", "2", "3", "4", "5", "6", "7"]);
});

test("postKind 识别：text/image/video/link/quote/reply/repost", () => {
  const byId = new Map(parseUserTweets(payload).map((t) => [t.id, t]));
  assert.equal(classifyPostKind(byId.get("1")!), "text");
  assert.equal(classifyPostKind(byId.get("2")!), "image");
  assert.equal(classifyPostKind(byId.get("3")!), "video");
  assert.equal(classifyPostKind(byId.get("4")!), "link");
  assert.equal(classifyPostKind(byId.get("5")!), "quote");
  assert.equal(classifyPostKind(byId.get("6")!), "reply");
  assert.equal(classifyPostKind(byId.get("7")!), "repost");
});

test("默认过滤：丢弃 replies + reposts，保留 quotes", () => {
  const kept = filterTweets(parseUserTweets(payload)).map((t) => t.id).sort();
  assert.deepEqual(kept, ["1", "2", "3", "4", "5"]); // 6(reply) / 7(repost) 被丢
});

test("可选开关：includeReplies / includeReposts 打开后保留", () => {
  const all = filterTweets(parseUserTweets(payload), {
    includeReplies: true,
    includeReposts: true,
  });
  assert.equal(all.length, 7);
});

test("mapTweet：externalId=postId（去重键），url 用 handle，无 customTitle", () => {
  const t = parseUserTweets(payload).find((x) => x.id === "2")!;
  const n = mapTweet(t);
  assert.equal(n.externalId, "2");
  assert.equal(n.url, "https://x.com/alice/status/2");
  assert.equal(n.postKind, "image");
  assert.equal(n.title, null); // X 无标题，交给规则拟题；连接器不产出 customTitle
  assert.equal("customTitle" in n, false);
  assert.ok(Array.isArray(n.media));
});

test("引用推文进入 linkCards（被引用小卡片）", () => {
  const quote = parseUserTweets(payload).find((x) => x.id === "5")!;
  assert.ok(quote.quoted);
  // quoted 没有 url（夹具未给 screen+id 同时齐全？）这里 BOB 有 screen，id=50 → 有 url
  const n = mapTweet(quote);
  const cards = (n.linkCards as { url: string; title: string | null }[]) ?? [];
  assert.ok(cards.some((c) => /\/status\/50$/.test(c.url)));
  assert.equal(cards.find((c) => /\/status\/50$/.test(c.url))?.title, "引用 @bob：被引用的原文");
});

test("parseUserTweets：新版 user core + quoted_status_permalink 生成规范 quote card", () => {
  const freshPayload = {
    data: {
      user: {
        result: {
          timeline_v2: {
            timeline: {
              instructions: [
                {
                  entries: [
                    tweetEntry(
                      "8",
                      {
                        full_text: "引用新版结构",
                        created_at: "Wed Oct 10 20:19:24 +0000 2018",
                        is_quote_status: true,
                        quoted_status_permalink: {
                          expanded: "https://twitter.com/corebob/status/88",
                          display: "twitter.com/corebob/status/88",
                          url: "https://t.co/quote",
                        },
                      },
                      CORE_ALICE,
                    ),
                  ],
                },
              ],
            },
          },
        },
      },
    },
  };
  (freshPayload.data.user.result.timeline_v2.timeline.instructions[0].entries[0] as any)
    .content.itemContent.tweet_results.result.quoted_status_result = {
      result: {
        rest_id: "88",
        legacy: { id_str: "88", full_text: "被引用新版原文" },
        core: CORE_BOB,
      },
    };

  const quote = parseUserTweets(freshPayload)[0];
  assert.equal(quote.screenName, "alicecore");
  assert.equal(quote.quoted?.screen, "corebob");
  assert.equal(quote.quoted?.url, "https://x.com/corebob/status/88");

  const n = mapTweet(quote);
  const cards = (n.linkCards as { url: string; title: string | null }[]) ?? [];
  assert.equal(cards.length, 1);
  assert.equal(cards[0].url, "https://x.com/corebob/status/88");
  assert.equal(cards[0].title, "引用 @corebob：被引用新版原文");
});

test("tweetsToItems：一步到位，默认产出 5 条（去 reply/repost）", () => {
  const items = tweetsToItems(payload);
  assert.equal(items.length, 5);
  assert.ok(items.every((i) => i.postKind && i.externalId));
});

test("classifyPostKind：纯逻辑优先级（repost 高于一切）", () => {
  const base: RawTweet = {
    id: "x", text: "t", createdAt: "", author: null, screenName: null,
    isReply: true, isRepost: true, isQuote: true, isThread: false,
    quoted: null, media: [{ type: "photo", thumb: "u" }], links: [{ url: "u", domain: "d", title: null }],
  };
  assert.equal(classifyPostKind(base), "repost");
});

function rawQuote(quoted: NonNullable<RawTweet["quoted"]>, links = quoted.url ? [
  { url: quoted.url, domain: "x.com", title: "x.com/bob/status/50" },
] : []): RawTweet {
  return {
    id: "q",
    text: "看看这个 https://t.co/quoted",
    createdAt: "Wed Oct 10 20:19:24 +0000 2018",
    author: "Alice",
    screenName: "alice",
    isReply: false,
    isRepost: false,
    isQuote: true,
    isThread: false,
    quoted,
    media: [],
    links,
  };
}

test("mapTweet：quote linkCard 去重，避免 entities.urls 与合成引用卡重复", () => {
  const url = "https://x.com/bob/status/50";
  const n = mapTweet(rawQuote(
    { text: "原文", author: "Bob", screen: "bob", url },
    [
      { url, domain: "x.com", title: "x.com/bob/status/50" },
      { url: "https://example.com/article", domain: "example.com", title: "example.com/article" },
    ],
  ));
  const cards = (n.linkCards as { url: string }[]) ?? [];
  assert.equal(cards.filter((c) => c.url === url).length, 1);
  assert.ok(cards.some((c) => c.url === "https://example.com/article"));
});

test("mapTweet：twitter.com expanded quote 链接与 x.com 合成卡归一去重", () => {
  const n = mapTweet(rawQuote(
    { text: "原文", author: "Bob", screen: "bob", url: "https://twitter.com/bob/status/50" },
    [
      { url: "https://www.twitter.com/bob/status/50", domain: "twitter.com", title: "twitter.com/bob/status/50" },
      { url: "https://example.com/article", domain: "example.com", title: "example.com/article" },
    ],
  ));
  const cards = (n.linkCards as { url: string }[]) ?? [];
  assert.equal(cards.filter((c) => c.url === "https://x.com/bob/status/50").length, 1);
  assert.equal(cards.filter((c) => normalizeXStatusUrl(c.url) === "https://x.com/bob/status/50").length, 1);
  assert.ok(cards.some((c) => c.url === "https://example.com/article"));
});

test("mapTweet：引用标题使用 screen_name，无 screen 时不用 @，都没有时兜底", () => {
  const withScreen = mapTweet(rawQuote({
    text: "原文",
    author: "Bob Display",
    screen: "bob",
    url: "https://x.com/bob/status/50",
  }));
  assert.equal((withScreen.linkCards as { title: string | null }[])[0].title, "引用 @bob：原文");

  const withDisplayName = mapTweet(rawQuote({
    text: "原文",
    author: "Bob Display",
    screen: null,
    url: "https://x.com/i/status/50",
  }));
  assert.equal((withDisplayName.linkCards as { title: string | null }[])[0].title, "引用 Bob Display：原文");

  const fallback = mapTweet(rawQuote({
    text: "原文",
    author: null,
    screen: null,
    url: "https://x.com/i/status/51",
  }));
  assert.equal((fallback.linkCards as { title: string | null }[])[0].title, "引用了一条推文");
});

test("mapTweet：excerpt 只剥离结尾裸 t.co，中段保留", () => {
  const trailing: RawTweet = {
    id: "t1",
    text: "hello https://t.co/a1 https://t.co/b2",
    createdAt: "",
    author: null,
    screenName: "alice",
    isReply: false,
    isRepost: false,
    isQuote: false,
    isThread: false,
    quoted: null,
    media: [],
    links: [],
  };
  assert.equal(mapTweet(trailing).excerpt, "hello");

  const middle = { ...trailing, id: "t2", text: "hello https://t.co/mid world https://t.co/end" };
  assert.equal(mapTweet(middle).excerpt, "hello https://t.co/mid world");
});

test("mapTweet：excerpt 截断不会切断 emoji 代理对", () => {
  const rt: RawTweet = {
    id: "emoji-excerpt",
    text: `${"a".repeat(279)}😀tail`,
    createdAt: "",
    author: null,
    screenName: "alice",
    isReply: false,
    isRepost: false,
    isQuote: false,
    isThread: false,
    quoted: null,
    media: [],
    links: [],
  };
  const excerpt = mapTweet(rt).excerpt!;
  assert.equal(excerpt.length <= 280, true);
  assert.equal(excerpt.isWellFormed(), true);
});

test("mapTweet：quote 标题截断不会切断 emoji 代理对", () => {
  const n = mapTweet(rawQuote({
    text: `${"a".repeat(91)}😀tail`,
    author: "Bob",
    screen: "bob",
    url: "https://x.com/bob/status/emoji",
  }));
  const title = ((n.linkCards as { title: string | null }[]) ?? [])[0]?.title ?? "";
  assert.equal(title.length <= 100, true);
  assert.equal(title.isWellFormed(), true);
});

test("normalizeXStatusUrl：twitter/x 状态链接域名归一，外站保持原样", () => {
  assert.equal(normalizeXStatusUrl("https://twitter.com/a/status/1"), "https://x.com/a/status/1");
  assert.equal(normalizeXStatusUrl("http://www.twitter.com/a/status/1"), "https://x.com/a/status/1");
  assert.equal(normalizeXStatusUrl("https://x.com/a/status/1"), "https://x.com/a/status/1");
  assert.equal(normalizeXStatusUrl("https://example.com/a/status/1"), "https://example.com/a/status/1");
});
