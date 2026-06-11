// X (Twitter) 纯逻辑（无网络 / 无浏览器，可被 node --test 直跑）：
// handle 解析、UserTweets GraphQL 响应解析、postKind 分类、tweet → NormalizedItem。
import type { NormalizedItem } from "../normalize.ts";
import { truncate } from "../text.ts";

const EXCERPT_MAX = 280;

// x.com 上不是用户名的保留路径，避免把 /home、/search 当成 handle。
const RESERVED = new Set([
  "home", "explore", "notifications", "messages", "i", "search", "settings",
  "compose", "hashtag", "intent", "login", "logout", "signup", "tos", "privacy",
]);

/** 解析 X 用户名：@handle / handle / x.com|twitter.com/{handle}（含 /status 链接）。无法解析返回 null。 */
export function parseXInput(input: string): string | null {
  let s = (input || "").trim();
  if (!s) return null;
  s = s.replace(/^@/, "");
  const urlMatch = s.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})/i);
  if (urlMatch) {
    const h = urlMatch[1].toLowerCase();
    return RESERVED.has(h) ? null : h;
  }
  if (/^[A-Za-z0-9_]{1,15}$/.test(s)) {
    const h = s.toLowerCase();
    return RESERVED.has(h) ? null : h;
  }
  return null;
}

export type PostKind =
  | "text" | "image" | "video" | "link" | "quote" | "reply" | "repost" | "thread" | "unknown";

export interface XMediaItem {
  type: "photo" | "video" | "gif";
  thumb: string | null;
}
export interface XLink {
  url: string;
  domain: string;
  title: string | null;
}
export interface RawTweet {
  id: string;
  text: string;
  createdAt: string;
  author: string | null;
  screenName: string | null;
  isReply: boolean;
  isRepost: boolean;
  isQuote: boolean;
  isThread: boolean;
  quoted: { text: string; author: string | null; screen: string | null; url: string | null } | null;
  media: XMediaItem[];
  links: XLink[];
}

export interface XFilterOptions {
  includeReplies?: boolean; // 默认 false
  includeReposts?: boolean; // 默认 false
  includeQuotes?: boolean; // 默认 true
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function normalizeXStatusUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return url;
    if (!/^(?:www\.)?(?:twitter|x)\.com$/i.test(u.hostname)) return url;
    return `https://x.com${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

/* ----------------------------- GraphQL 解析 ----------------------------- */

type AnyObj = Record<string, unknown>;
const obj = (v: unknown): AnyObj => (v && typeof v === "object" ? (v as AnyObj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** 从 tweet_results.result 里取真正的 tweet 节点（兼容 TweetWithVisibilityResults）。 */
function tweetNode(result: unknown): AnyObj | null {
  let r = obj(result);
  if (str(r.__typename) === "TweetWithVisibilityResults") r = obj(r.tweet);
  if (!r.legacy && !r.rest_id) return null;
  return r;
}

function mediaFrom(legacy: AnyObj): XMediaItem[] {
  const ext = obj(legacy.extended_entities);
  const list = arr(ext.media);
  const out: XMediaItem[] = [];
  for (const m of list) {
    const mo = obj(m);
    const t = str(mo.type); // photo | video | animated_gif
    const thumb = str(mo.media_url_https) || null;
    out.push({
      type: t === "video" ? "video" : t === "animated_gif" ? "gif" : "photo",
      thumb,
    });
  }
  return out;
}

function linksFrom(legacy: AnyObj): XLink[] {
  const entities = obj(legacy.entities);
  const urls = arr(entities.urls);
  const out: XLink[] = [];
  for (const u of urls) {
    const uo = obj(u);
    const expanded = str(uo.expanded_url) || str(uo.url);
    if (!expanded) continue;
    out.push({ url: expanded, domain: domainOf(expanded), title: str(uo.display_url) || null });
  }
  return out;
}

function authorFrom(node: AnyObj): { name: string | null; screen: string | null } {
  const userResult = obj(obj(obj(node.core).user_results).result);
  const userLegacy = obj(userResult.legacy);
  const userCore = obj(userResult.core);
  return {
    name: str(userLegacy.name) || str(userCore.name) || null,
    screen: str(userLegacy.screen_name) || str(userCore.screen_name) || null,
  };
}

function buildRawTweet(node: AnyObj, isThread: boolean): RawTweet | null {
  const legacy = obj(node.legacy);
  const id = str(node.rest_id) || str(legacy.id_str);
  if (!id) return null;

  const isRepost = !!legacy.retweeted_status_result;
  const isReply = !!str(legacy.in_reply_to_status_id_str);
  const isQuote = !!legacy.is_quote_status && !!node.quoted_status_result;

  const { name, screen } = authorFrom(node);

  let quoted: RawTweet["quoted"] = null;
  if (isQuote) {
    const qn = tweetNode(obj(node.quoted_status_result).result);
    if (qn) {
      const qLegacy = obj(qn.legacy);
      const qa = authorFrom(qn);
      const qId = str(qn.rest_id) || str(qLegacy.id_str);
      const permalink = obj(legacy.quoted_status_permalink);
      const permalinkUrl = str(permalink.expanded) || str(permalink.url);
      quoted = {
        text: str(qLegacy.full_text),
        author: qa.name,
        screen: qa.screen,
        url: permalinkUrl
          ? normalizeXStatusUrl(permalinkUrl)
          : qa.screen && qId
            ? `https://x.com/${qa.screen}/status/${qId}`
            : null,
      };
    }
  }

  return {
    id,
    text: str(legacy.full_text),
    createdAt: str(legacy.created_at),
    author: name,
    screenName: screen,
    isReply,
    isRepost,
    isQuote,
    isThread,
    quoted,
    media: mediaFrom(legacy),
    links: linksFrom(legacy),
  };
}

/** 遍历 UserTweets GraphQL 响应，抽出全部 tweet（含线程模块内的子条目）。 */
export function parseUserTweets(payload: unknown): RawTweet[] {
  const root = obj(payload);
  const instructions = arr(
    obj(obj(obj(obj(obj(root.data).user).result).timeline_v2).timeline).instructions,
  );
  // 兼容旧字段 timeline（无 _v2）
  const alt = arr(obj(obj(obj(obj(obj(root.data).user).result).timeline).timeline).instructions);
  const allInstr = instructions.length ? instructions : alt;

  const out: RawTweet[] = [];
  const seen = new Set<string>();
  const push = (rt: RawTweet | null) => {
    if (rt && !seen.has(rt.id)) {
      seen.add(rt.id);
      out.push(rt);
    }
  };

  for (const ins of allInstr) {
    const entries = arr(obj(ins).entries);
    // 单条指令也可能直接带 entry
    if (!entries.length && obj(ins).entry) entries.push(obj(ins).entry);
    for (const e of entries) {
      const entry = obj(e);
      const entryId = str(entry.entryId);
      const content = obj(entry.content);

      // 1) 普通推文条目
      const itemContent = obj(content.itemContent);
      if (itemContent.tweet_results) {
        const node = tweetNode(obj(itemContent.tweet_results).result);
        push(buildRawTweet(obj(node), /^profile-conversation-|^homeConversation/i.test(entryId)));
        continue;
      }
      // 2) 线程 / 会话模块：content.items[].item.itemContent.tweet_results
      const items = arr(content.items);
      if (items.length) {
        const isThread = /conversation/i.test(entryId);
        for (const it of items) {
          const ic = obj(obj(obj(it).item).itemContent);
          if (ic.tweet_results) {
            push(buildRawTweet(obj(tweetNode(obj(ic.tweet_results).result)), isThread));
          }
        }
      }
    }
  }
  return out;
}

/* ----------------------------- 分类 + 过滤 + 映射 ----------------------------- */

/** 帖子类型：repost>reply>quote>video>image>link>text。 */
export function classifyPostKind(rt: RawTweet): PostKind {
  if (rt.isRepost) return "repost";
  if (rt.isReply) return "reply";
  if (rt.isQuote) return "quote";
  if (rt.media.some((m) => m.type === "video" || m.type === "gif")) return "video";
  if (rt.media.some((m) => m.type === "photo")) return "image";
  if (rt.links.length > 0) return "link";
  if (rt.text.trim()) return "text";
  return "unknown";
}

/** 默认丢弃 replies / reposts；保留 quotes。 */
export function filterTweets(tweets: RawTweet[], opts?: XFilterOptions): RawTweet[] {
  const includeReplies = opts?.includeReplies ?? false;
  const includeReposts = opts?.includeReposts ?? false;
  const includeQuotes = opts?.includeQuotes ?? true;
  return tweets.filter((t) => {
    if (t.isRepost && !includeReposts) return false;
    if (t.isReply && !includeReplies) return false;
    if (t.isQuote && !includeQuotes) return false;
    return true;
  });
}

/** 解析 Twitter 时间字符串（"Wed Oct 10 20:19:24 +0000 2018"）。失败用当前时间。 */
function parseTwitterDate(s: string): Date {
  const d = new Date(s);
  return Number.isNaN(+d) ? new Date() : d;
}

function stripTrailingTco(text: string): string {
  return text.replace(/(?:\s+https?:\/\/t\.co\/\w+)+\s*$/i, "").trim();
}

function quoteTitle(q: NonNullable<RawTweet["quoted"]>): string {
  const text = q.text.replace(/\s+/g, " ").trim();
  if (q.screen) return truncate(`引用 @${q.screen}${text ? `：${text}` : ""}`, 100);
  if (q.author) return truncate(`引用 ${q.author}${text ? `：${text}` : ""}`, 100);
  return "引用了一条推文";
}

/** RawTweet → 标准 Item。externalId = postId。 */
export function mapTweet(rt: RawTweet): NormalizedItem {
  const kind = classifyPostKind(rt);
  const screen = rt.screenName || "i";
  const tags: string[] = [];
  if (rt.isThread) tags.push("Thread");
  // 引用的推文作为一张卡片（被引用小卡片，P0 简化版）。
  const quotedUrl = rt.quoted?.url ? normalizeXStatusUrl(rt.quoted.url) : null;
  const links: XLink[] = quotedUrl
    ? rt.links.filter((l) => normalizeXStatusUrl(l.url) !== quotedUrl)
    : [...rt.links];
  if (rt.quoted && quotedUrl) {
    links.push({
      url: quotedUrl,
      domain: "x.com",
      title: quoteTitle(rt.quoted),
    });
  }
  const excerpt = truncate(stripTrailingTco(rt.text.replace(/\s+/g, " ").trim()), EXCERPT_MAX);
  return {
    externalId: rt.id,
    title: null, // X 无标题，交给规则拟题
    excerpt: excerpt || null,
    url: `https://x.com/${screen}/status/${rt.id}`,
    thumbnailUrl: rt.media.find((m) => m.thumb)?.thumb ?? null,
    durationSec: null,
    author: rt.author,
    publishedAt: parseTwitterDate(rt.createdAt),
    raw: JSON.stringify(rt),
    postKind: kind,
    platformTags: tags.length ? tags : null,
    media: rt.media,
    linkCards: links,
  };
}

/** 解析 + 过滤 + 映射 一步到位。 */
export function tweetsToItems(payload: unknown, opts?: XFilterOptions): NormalizedItem[] {
  return filterTweets(parseUserTweets(payload), opts).map(mapTweet);
}
