// Bilibili 纯逻辑：mid/URL 解析、WBI 签名、arc/search 解析、投稿映射、videoKind、合集标签。
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBilibiliInput,
  videoKindFromDuration,
  getMixinKey,
  imgSubKeyFromNav,
  encWbi,
  parseArcSearch,
  parseNavIsLogin,
  BiliApiError,
  mapArchive,
  mapArchives,
  archiveTags,
  normalizeBiliPic,
  runArcSearchWithFallback,
  blankArcDiag,
  type ArcFallbackDeps,
  type BiliArchive,
} from "../src/lib/connectors/bilibili.ts";

const OK_JSON = {
  code: 0,
  data: {
    list: { vlist: [{ bvid: "BV1", title: "t", created: 1700000000, length: "1:00" }] },
    page: { count: 1 },
  },
};
const KEYS = { imgKey: "aaa", subKey: "bbb" };
function baseDeps(over: Partial<ArcFallbackDeps>): ArcFallbackDeps {
  return {
    getKeys: async () => KEYS,
    sign: (k) => `https://api/?${k.imgKey}${k.subKey}`,
    nodeGet: async () => OK_JSON,
    browserGet: async () => OK_JSON,
    hasLoginProfile: true,
    ...over,
  };
}

test("parseBilibiliInput：纯 mid", () => {
  assert.equal(parseBilibiliInput("123456"), "123456");
  assert.equal(parseBilibiliInput("  77777  "), "77777");
});

test("parseBilibiliInput：space 主页链接", () => {
  assert.equal(parseBilibiliInput("https://space.bilibili.com/123456"), "123456");
  assert.equal(parseBilibiliInput("https://space.bilibili.com/123456/video?tid=0"), "123456");
  assert.equal(parseBilibiliInput("space.bilibili.com/9527/dynamic"), "9527");
});

test("parseBilibiliInput：无法解析返回 null", () => {
  assert.equal(parseBilibiliInput(""), null);
  assert.equal(parseBilibiliInput("https://www.bilibili.com/video/BV1xx"), null); // 视频链接不是 UP 主页
  assert.equal(parseBilibiliInput("不是链接也不是数字"), null);
});

test("videoKindFromDuration：<=180 short，>180 video，空 unknown", () => {
  assert.equal(videoKindFromDuration(180), "short");
  assert.equal(videoKindFromDuration(60), "short");
  assert.equal(videoKindFromDuration(181), "video");
  assert.equal(videoKindFromDuration(null), "unknown");
  assert.equal(videoKindFromDuration(undefined), "unknown");
});

test("getMixinKey：长度 32、确定性", () => {
  const orig = "7cd084941338484aae1ad9425b84077c4932caff0ff746eab6f01bf08b70ac45";
  const k = getMixinKey(orig);
  assert.equal(k.length, 32);
  assert.equal(getMixinKey(orig), k);
});

test("imgSubKeyFromNav：从 nav 取文件名去扩展名", () => {
  const nav = {
    data: {
      wbi_img: {
        img_url: "https://i0.hdslb.com/bfs/wbi/aaa111.png",
        sub_url: "https://i0.hdslb.com/bfs/wbi/bbb222.png",
      },
    },
  };
  assert.deepEqual(imgSubKeyFromNav(nav), { imgKey: "aaa111", subKey: "bbb222" });
});

test("encWbi：固定输入 → 稳定 32 位 w_rid，query 含 wts/w_rid", () => {
  const a = encWbi({ mid: "123", pn: 1, ps: 30, order: "pubdate" }, "aaa111", "bbb222", 1700000000);
  const b = encWbi({ mid: "123", pn: 1, ps: 30, order: "pubdate" }, "aaa111", "bbb222", 1700000000);
  assert.match(a.wRid, /^[0-9a-f]{32}$/);
  assert.equal(a.wRid, b.wRid); // 确定性
  assert.match(a.query, /wts=1700000000/);
  assert.match(a.query, /w_rid=[0-9a-f]{32}/);
  assert.equal((a.query.match(/(?:^|&)wts=/g) ?? []).length, 1);
});

test("parseArcSearch：code 0 → 取 vlist + total", () => {
  const r = parseArcSearch({
    code: 0,
    data: { list: { vlist: [{ bvid: "BV1" }, { bvid: "BV2" }] }, page: { count: 42 } },
  });
  assert.equal(r.items.length, 2);
  assert.equal(r.total, 42);
});

test("parseArcSearch：风控 -412 抛 BiliApiError 且 needsAuth", () => {
  try {
    parseArcSearch({ code: -412, message: "risk" });
    assert.fail("应当抛错");
  } catch (e) {
    assert.ok(e instanceof BiliApiError);
    assert.equal((e as BiliApiError).code, -412);
    assert.equal((e as BiliApiError).needsAuth, true);
  }
});

test("parseArcSearch：-101 未登录 needsAuth", () => {
  try {
    parseArcSearch({ code: -101, message: "not login" });
    assert.fail("应当抛错");
  } catch (e) {
    assert.equal((e as BiliApiError).needsAuth, true);
  }
});

test("BiliApiError：-352 / -403 / -101 / -412 都 needsAuth；普通错误不是", () => {
  assert.equal(new BiliApiError(-352, "").needsAuth, true);
  assert.equal(new BiliApiError(-403, "").needsAuth, true);
  assert.equal(new BiliApiError(-101, "").needsAuth, true);
  assert.equal(new BiliApiError(-412, "").needsAuth, true);
  assert.equal(new BiliApiError(-400, "").needsAuth, false);
});

test("parseArcSearch：-352 抛 BiliApiError 且 needsAuth", () => {
  try {
    parseArcSearch({ code: -352, message: "risk verify" });
    assert.fail("应当抛错");
  } catch (e) {
    assert.ok(e instanceof BiliApiError);
    assert.equal((e as BiliApiError).code, -352);
    assert.equal((e as BiliApiError).needsAuth, true);
  }
});

// —— 核心修复：-352 在“解析阶段”触发登录态回退 ——

test("fallback：-352(HTTP200 body) 走解析阶段回退，登录态成功", async () => {
  const diag = blankArcDiag();
  const parsed = await runArcSearchWithFallback(
    baseDeps({ nodeGet: async () => ({ code: -352, message: "risk" }), browserGet: async () => OK_JSON }),
    diag,
  );
  assert.equal(parsed.items.length, 1);
  assert.equal(diag.usedFallback, true);
  assert.equal(diag.fallbackStage, "parse_response"); // 关键：是解析阶段，不是请求阶段
  assert.equal(diag.firstApiCode, -352);
  assert.equal(diag.fallbackApiCode, 0);
});

test("fallback：提供 getKeysViaBrowser 时会重取登录态 WBI 并重签", async () => {
  const diag = blankArcDiag();
  let browserUrl = "";
  await runArcSearchWithFallback(
    baseDeps({
      nodeGet: async () => ({ code: -352 }),
      getKeysViaBrowser: async () => ({ keys: { imgKey: "ccc", subKey: "ddd" }, navCode: 0, navIsLogin: true }),
      browserGet: async (url) => {
        browserUrl = url;
        return { body: OK_JSON, mode: "context.request", contextRequestCode: 0 };
      },
    }),
    diag,
  );
  assert.equal(diag.refetchedLoginWbi, true);
  assert.equal(diag.fallbackNavCode, 0);
  assert.equal(diag.fallbackNavIsLogin, true);
  assert.equal(diag.fallbackSignedWith, "login");
  assert.equal(diag.fallbackRequestMode, "context.request");
  assert.equal(diag.fallbackContextRequestCode, 0);
  assert.match(browserUrl, /cccddd/); // 用的是登录态重取的 keys 重签的 URL
});

test("fallback：context.request 失败后可记录 page.evaluate 结果", async () => {
  const diag = blankArcDiag();
  const parsed = await runArcSearchWithFallback(
    baseDeps({
      nodeGet: async () => ({ code: -352 }),
      browserGet: async () => ({
        body: OK_JSON,
        mode: "page.evaluate",
        contextRequestCode: -403,
        contextRequestMessage: "Forbidden",
        pageEvaluateCode: 0,
        pageEvaluateMessage: "OK",
      }),
    }),
    diag,
  );
  assert.equal(parsed.items.length, 1);
  assert.equal(diag.fallbackRequestMode, "page.evaluate");
  assert.equal(diag.fallbackContextRequestCode, -403);
  assert.equal(diag.fallbackPageEvaluateCode, 0);
});

test("fallback：HTTP 412 在请求阶段回退（node_request）", async () => {
  const diag = blankArcDiag();
  const parsed = await runArcSearchWithFallback(
    baseDeps({
      nodeGet: async () => {
        throw new BiliApiError(-412, "412");
      },
      browserGet: async () => OK_JSON,
    }),
    diag,
  );
  assert.equal(diag.fallbackStage, "node_request");
  assert.equal(diag.firstApiCode, -412);
  assert.equal(diag.usedFallback, true);
  assert.equal(parsed.items.length, 1);
});

test("fallback：回退后仍 -352 → 抛错，但 diag 记录前后 code", async () => {
  const diag = blankArcDiag();
  await assert.rejects(
    runArcSearchWithFallback(
      baseDeps({
        nodeGet: async () => ({ code: -352 }),
        browserGet: async () => ({ code: -352, message: "still risk" }),
      }),
      diag,
    ),
  );
  assert.equal(diag.usedFallback, true);
  assert.equal(diag.firstApiCode, -352);
  assert.equal(diag.fallbackApiCode, -352);
});

test("fallback：无登录态时不回退（usedFallback=false）", async () => {
  const diag = blankArcDiag();
  await assert.rejects(
    runArcSearchWithFallback(
      baseDeps({
        hasLoginProfile: false,
        nodeGet: async () => ({ code: -352 }),
        browserGet: async () => {
          throw new Error("不应被调用");
        },
      }),
      diag,
    ),
  );
  assert.equal(diag.usedFallback, false);
  assert.equal(diag.fallbackStage, "parse_response"); // 阶段已判定，但因无登录态没回退
});

test("parseNavIsLogin：已登录 / 未登录 / 缺字段", () => {
  assert.deepEqual(parseNavIsLogin({ code: 0, data: { isLogin: true } }), { isLogin: true, code: 0 });
  assert.deepEqual(parseNavIsLogin({ code: -101, data: { isLogin: false } }), {
    isLogin: false,
    code: -101,
  });
  assert.deepEqual(parseNavIsLogin({}), { isLogin: false, code: -1 });
});

test("normalizeBiliPic：补全 https", () => {
  assert.equal(normalizeBiliPic("//i0.hdslb.com/a.jpg"), "https://i0.hdslb.com/a.jpg");
  assert.equal(normalizeBiliPic("http://i0.hdslb.com/a.jpg"), "https://i0.hdslb.com/a.jpg");
  assert.equal(normalizeBiliPic(null), null);
});

const sampleArchive: BiliArchive = {
  bvid: "BV1xx411c7mQ",
  title: "三分钟讲清楚",
  description: "一个简介",
  pic: "//i0.hdslb.com/cover.jpg",
  length: "2:30", // 150s → short
  created: 1700000000,
  author: "某UP主",
  typename: "科技",
  meta: { title: "AI 系列合集" },
};

test("mapArchive：externalId=bvid（去重键），字段映射，short + 合集/分区标签", () => {
  const n = mapArchive(sampleArchive)!;
  assert.equal(n.externalId, "BV1xx411c7mQ"); // bvid 作为去重键
  assert.equal(n.title, "三分钟讲清楚");
  assert.equal(n.url, "https://www.bilibili.com/video/BV1xx411c7mQ");
  assert.equal(n.thumbnailUrl, "https://i0.hdslb.com/cover.jpg");
  assert.equal(n.durationSec, 150);
  assert.equal(n.videoKind, "short"); // 150 <= 180
  assert.deepEqual(n.platformTags, ["AI 系列合集", "科技"]); // 合集在前、分区在后
  // 连接器从不产出 customTitle（升级 upsert 时永不覆盖用户标题）
  assert.equal("customTitle" in n, false);
});

test("archiveTags：合集 + 分区，去重", () => {
  assert.deepEqual(archiveTags(sampleArchive), ["AI 系列合集", "科技"]);
  assert.deepEqual(archiveTags({ bvid: "x", typename: "科技", meta: { title: "科技" } }), ["科技"]);
});

test("mapArchives：丢弃无 bvid 的条目", () => {
  const out = mapArchives([sampleArchive, { title: "无 bvid" } as BiliArchive]);
  assert.equal(out.length, 1);
});

test("合集不创建独立 Item：合集只作为标签，映射出来的是 UP 的视频", () => {
  // 输入是 UP 的投稿（vlist），每条都是视频；合集名只进 platformTags，不会产出“合集卡片”。
  const n = mapArchive(sampleArchive)!;
  assert.equal(n.url.includes("/video/"), true); // 是视频卡片
  assert.ok((n.platformTags ?? []).includes("AI 系列合集")); // 合集是标签
});
