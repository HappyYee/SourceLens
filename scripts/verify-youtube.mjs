#!/usr/bin/env node
// 源镜 SourceLens —— YouTube 抓取自检（独立脚本，用 undici 走代理，可在 Mac 直接跑）。
//
// 它复刻了 app 的真实抓取路径：YouTube 频道 RSS 发现新视频 → YouTube Data API
// 批量补「时长 / 封面 / 频道名」，再按发布时间把多个频道归并成一条时间线。
// 用来快速确认「源 + key + 网络」三者打通，和 src/lib/connectors 里的实现等价。
//
// 用法：
//   export YOUTUBE_API_KEY=...                 # 或写进 .env
//   node scripts/verify-youtube.mjs            # 默认验证 Two Minute Papers + Andrej Karpathy
//   node scripts/verify-youtube.mjs UCxxxx @someHandle   # 自定义频道（ID 或 @handle 均可）

import { readFileSync } from "node:fs";
import { setGlobalDispatcher, ProxyAgent } from "undici";

// 让 Node fetch 走本地代理（curl 能通但 Node fetch 默认不认代理）。优先级 HTTPS > HTTP > ALL。
const PROXY =
  process.env.HTTPS_PROXY || process.env.https_proxy ||
  process.env.HTTP_PROXY || process.env.http_proxy ||
  process.env.ALL_PROXY || process.env.all_proxy;
if (PROXY && /^https?:\/\//i.test(PROXY)) {
  setGlobalDispatcher(new ProxyAgent(PROXY));
  console.log("[proxy] fetch 已走代理：" + PROXY);
} else if (PROXY) {
  console.log("[proxy] 非 http(s) 代理(" + PROXY + ")，undici 不支持；请设 HTTPS_PROXY=http://…");
}

// 没有显式 env 时，兜底从 .env 读一行 YOUTUBE_API_KEY
let KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) {
  try {
    const m = readFileSync(new URL("../.env", import.meta.url), "utf8").match(/^YOUTUBE_API_KEY=(.+)$/m);
    if (m) KEY = m[1].trim();
  } catch {}
}
if (!KEY) {
  console.error("✗ 缺少 YOUTUBE_API_KEY（export，或写进项目根目录 .env）。");
  process.exit(1);
}

const DEFAULTS = ["UCbfYPyITQ-7l4upoX8nvctg" /* Two Minute Papers */, "UCXUPKJO5MZQN11PqgIvyuvQ" /* Andrej Karpathy */];
const inputs = process.argv.slice(2);
const targets = inputs.length ? inputs : DEFAULTS;

const isChannelId = (s) => /^UC[\w-]{22}$/.test(s);

async function resolveChannelId(s) {
  if (isChannelId(s)) return s;
  const handle = s.startsWith("@") ? s : "@" + s;
  const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${KEY}`);
  const j = await r.json();
  if (j.error) throw new Error(`Data API ${j.error.code}: ${j.error.message}`);
  return j.items?.[0]?.id ?? null;
}

function parseISO8601(s) {
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(s || "");
  if (!m) return null;
  const d = +m[1] || 0, h = +m[2] || 0, mi = +m[3] || 0, se = +m[4] || 0;
  return ((d * 24 + h) * 60 + mi) * 60 + se || null;
}

function fmtDur(s) {
  if (s == null) return "—";
  const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
}

async function fetchChannel(cid) {
  const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`)).text();
  const ids = [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].map((m) => m[1]);
  if (!ids.length) return [];
  const j = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ids.join(",")}&key=${KEY}`)).json();
  if (j.error) throw new Error(`Data API ${j.error.code}: ${j.error.message}`);
  return (j.items || []).map((it) => {
    const th = it.snippet.thumbnails || {};
    return {
      id: it.id,
      title: it.snippet.title,
      channel: it.snippet.channelTitle,
      durationSec: parseISO8601(it.contentDetails?.duration),
      thumb: (th.maxres || th.standard || th.high || th.medium || th.default)?.url ?? null,
      published: it.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${it.id}`,
    };
  });
}

const all = [];
for (const t of targets) {
  try {
    const cid = await resolveChannelId(t);
    if (!cid) { console.log(`✗ 无法解析频道：${t}`); continue; }
    const items = await fetchChannel(cid);
    console.log(`✓ ${t.padEnd(24)} ${cid}  → ${items.length} 条`);
    all.push(...items);
  } catch (e) {
    console.log(`✗ ${t}: ${e.message}`);
  }
}

all.sort((a, b) => new Date(b.published) - new Date(a.published));
console.log(`\n合并时间线（${all.length} 条 · 按发布时间倒序）:`);
for (const i of all.slice(0, 15)) {
  console.log(`  ${i.published.slice(0, 10)}  [${fmtDur(i.durationSec).padStart(7)}]  ${i.channel.padEnd(18)}  ${i.title.slice(0, 50)}`);
}

const withDur = all.filter((i) => i.durationSec != null).length;
const withThumb = all.filter((i) => i.thumb).length;
console.log(`\n字段完整度：时长 ${withDur}/${all.length} · 封面 ${withThumb}/${all.length} · 频道名 ${all.filter((i) => i.channel).length}/${all.length}`);
const pass = all.length > 0 && withDur === all.length && withThumb === all.length;
console.log(pass ? "\n结果：PASS ✓ 真实抓取 + 时长/封面补全 + 时间线归并 全部正常" : "\n结果：未全绿，见上方逐频道输出");
process.exit(pass ? 0 : 1);
