// Bilibili 纯逻辑（无网络 / 无浏览器，可被 node --test 直跑）：
// 输入解析、WBI 签名、arc/search 响应解析、投稿条目 → NormalizedItem、videoKind、合集/分区标签。
import { createHash } from "node:crypto";
import { parseDuration, stripHtml, type NormalizedItem } from "../normalize.ts";

const EXCERPT_MAX = 200;

/** 从输入解析 UP 主 mid：纯数字 / space.bilibili.com/{mid} / 各类主页链接。无法解析返回 null。 */
export function parseBilibiliInput(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s; // 纯 mid
  const m =
    s.match(/space\.bilibili\.com\/(\d+)/i) ||
    s.match(/bilibili\.com\/space\/(\d+)/i) ||
    s.match(/\/(\d{3,})(?:[/?#]|$)/); // 链接里的一长串数字兜底
  return m ? m[1] : null;
}

/** 通用视频类型：<=180s 记为 short，>180s 记为 video，无时长 unknown。 */
export function videoKindFromDuration(sec?: number | null): "short" | "video" | "unknown" {
  if (sec == null) return "unknown";
  return sec <= 180 ? "short" : "video";
}

/* --------------------------------- WBI 签名 --------------------------------- */

// 固定混淆表（B 站 WBI 算法）。
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33,
  9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26,
  17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34,
  44, 52,
];

/** 由 img_key + sub_key 按混淆表重排，取前 32 位，得到 mixin key。 */
export function getMixinKey(orig: string): string {
  return MIXIN_KEY_ENC_TAB.map((i) => orig[i] ?? "").join("").slice(0, 32);
}

/** 从 nav 接口响应里取 img_key / sub_key（文件名去扩展名）。 */
export function imgSubKeyFromNav(nav: unknown): { imgKey: string; subKey: string } {
  const wbi = (nav as { data?: { wbi_img?: { img_url?: string; sub_url?: string } } })?.data
    ?.wbi_img;
  const pick = (u?: string) => {
    const s = u ?? "";
    const file = s.slice(s.lastIndexOf("/") + 1);
    return file.split(".")[0] ?? "";
  };
  return { imgKey: pick(wbi?.img_url), subKey: pick(wbi?.sub_url) };
}

/**
 * 给参数加 wts 并计算 w_rid（md5）。返回已排序、可直接拼接的 query。
 * wtsOverride 仅供测试稳定化。
 */
export function encWbi(
  params: Record<string, string | number>,
  imgKey: string,
  subKey: string,
  wtsOverride?: number,
): { query: string; wRid: string; wts: number } {
  const mixinKey = getMixinKey(imgKey + subKey);
  const wts = wtsOverride ?? Math.round(Date.now() / 1000);
  const merged: Record<string, string | number> = { ...params, wts };
  const query = Object.keys(merged)
    .sort()
    .map((k) => {
      const val = String(merged[k]).replace(/[!'()*]/g, ""); // 过滤特殊字符
      return `${encodeURIComponent(k)}=${encodeURIComponent(val)}`;
    })
    .join("&");
  const wRid = createHash("md5").update(query + mixinKey).digest("hex");
  return { query: `${query}&w_rid=${wRid}`, wRid, wts };
}

/* ----------------------------- 响应解析 + 映射 ----------------------------- */

/** 带业务 code 的 B 站 API 错误，net 层据此决定是否回退到登录态浏览器。 */
export class BiliApiError extends Error {
  code: number;
  needsAuth: boolean;
  constructor(code: number, message: string) {
    super(message);
    this.name = "BiliApiError";
    this.code = code;
    // 这些 code 用登录态回退可能有救：-412/-799/HTTP风控、-101 未登录、-352 风控校验、-403 权限不足
    this.needsAuth =
      code === -412 || code === -799 || code === -101 || code === -352 || code === -403;
  }
}

/** 由 code 生成区分化文案（-352/-412/-799/-101/-403/-404 各不相同）。 */
export function biliCodeMessage(code: number, msg?: string): string {
  switch (code) {
    case -352:
      return "B 站风控校验失败（-352）：请放慢频率，或用 bilibili 登录态后重试";
    case -412:
      return "B 站风控拦截（-412）：请放慢频率，或用 bilibili 登录态后重试";
    case -799:
      return "请求过于频繁（-799），请稍后再试";
    case -101:
      return "未登录或登录态无效（-101）：请在设置页登录 bilibili 后重试";
    case -403:
      return "访问权限不足（-403）：可能需要登录态或该内容受限";
    case -404:
      return "找不到该 UP 主或其视频不可见（-404）";
    default:
      return `B 站接口返回错误 ${code}：${msg ?? ""}`;
  }
}

/** 读 JSON 顶层 code / message（非敏感）。 */
export function readCodeMsg(json: unknown): { code?: number; message?: string } {
  const j = json as { code?: number; message?: string };
  return {
    code: typeof j?.code === "number" ? j.code : undefined,
    message: typeof j?.message === "string" ? j.message : undefined,
  };
}

export interface BiliArchive {
  bvid: string;
  title?: string;
  description?: string;
  pic?: string;
  length?: string; // "MM:SS"
  created?: number; // 秒
  author?: string;
  typename?: string; // 分区名
  meta?: { title?: string } | null; // 合集名（season）
  [k: string]: unknown;
}

export interface ArcSearchParsed {
  items: BiliArchive[];
  total: number;
}

/** 解析 x/space/wbi/arc/search 响应。code!=0 抛 BiliApiError（含风控/未登录标记）。 */
export function parseArcSearch(json: unknown): ArcSearchParsed {
  const j = json as {
    code?: number;
    message?: string;
    data?: { list?: { vlist?: BiliArchive[] }; page?: { count?: number } };
  };
  const code = typeof j?.code === "number" ? j.code : -1;
  if (code !== 0) {
    throw new BiliApiError(code, biliCodeMessage(code, j?.message));
  }
  const vlist = j.data?.list?.vlist ?? [];
  return { items: vlist, total: j.data?.page?.count ?? vlist.length };
}

/** 解析 nav 接口的登录态：data.isLogin（非敏感，不含账号信息）。 */
export function parseNavIsLogin(json: unknown): { isLogin: boolean; code: number } {
  const j = json as { code?: number; data?: { isLogin?: boolean } };
  const code = typeof j?.code === "number" ? j.code : -1;
  return { isLogin: !!j?.data?.isLogin, code };
}

/** B 站图片地址补全为 https。 */
export function normalizeBiliPic(pic?: string | null): string | null {
  if (!pic) return null;
  if (pic.startsWith("//")) return "https:" + pic;
  if (pic.startsWith("http://")) return "https://" + pic.slice(7);
  return pic;
}

/** 收集合集 / 分区标签（去重、过滤空）。 */
export function archiveTags(v: BiliArchive): string[] {
  const tags: string[] = [];
  const season = v.meta?.title?.trim();
  if (season) tags.push(season);
  const part = typeof v.typename === "string" ? v.typename.trim() : "";
  if (part && !tags.includes(part)) tags.push(part);
  return tags;
}

/** 把一条 UP 投稿映射为标准 Item。externalId = bvid。 */
export function mapArchive(v: BiliArchive, fallbackAuthor?: string): NormalizedItem | null {
  const bvid = typeof v.bvid === "string" ? v.bvid : "";
  if (!bvid) return null;
  const durationSec = parseDuration(v.length);
  const desc = stripHtml(v.description).slice(0, EXCERPT_MAX);
  const tags = archiveTags(v);
  return {
    externalId: bvid,
    title: v.title?.trim() || null,
    excerpt: desc || null,
    url: `https://www.bilibili.com/video/${bvid}`,
    thumbnailUrl: normalizeBiliPic(v.pic),
    durationSec,
    author: v.author?.trim() || fallbackAuthor || null,
    publishedAt: v.created ? new Date(v.created * 1000) : new Date(),
    raw: JSON.stringify(v),
    videoKind: videoKindFromDuration(durationSec),
    platformTags: tags.length ? tags : null,
  };
}

/** 批量映射（丢弃无 bvid 的）。 */
export function mapArchives(items: BiliArchive[], fallbackAuthor?: string): NormalizedItem[] {
  const out: NormalizedItem[] = [];
  for (const v of items) {
    const n = mapArchive(v, fallbackAuthor);
    if (n) out.push(n);
  }
  return out;
}

/* --------------- arc/search 公开直连 + 登录态回退（统一编排，可注入） --------------- */
// 关键修复：-352 是 HTTP 200 + body code=-352，由 parseArcSearch 抛出（不是请求阶段）。
// 这里把"请求 + 解析"放在同一段，所以解析阶段的 needsAuth 错误也会触发登录态回退；
// 真实刷新与自检共用本编排，避免再次分叉。

export interface WbiKeys {
  imgKey: string;
  subKey: string;
}

export interface LoginWbiResult {
  keys: WbiKeys;
  navCode?: number;
  navIsLogin?: boolean;
}

export type FallbackStage = "none" | "node_request" | "parse_response";
export type FallbackSignedWith = "public" | "login";
export type FallbackRequestMode = "none" | "context.request" | "page.evaluate";

export interface BrowserJsonResult {
  body: unknown;
  mode: Exclude<FallbackRequestMode, "none">;
  contextRequestCode?: number;
  contextRequestMessage?: string;
  pageEvaluateCode?: number;
  pageEvaluateMessage?: string;
}

export interface ArcDiag {
  usedFallback: boolean;
  fallbackStage: FallbackStage;
  firstApiCode?: number;
  firstApiMessage?: string;
  fallbackApiCode?: number;
  fallbackApiMessage?: string;
  fallbackNavCode?: number;
  fallbackNavIsLogin?: boolean;
  fallbackSignedWith: FallbackSignedWith;
  fallbackRequestMode: FallbackRequestMode;
  fallbackContextRequestCode?: number;
  fallbackContextRequestMessage?: string;
  fallbackPageEvaluateCode?: number;
  fallbackPageEvaluateMessage?: string;
  refetchedLoginWbi: boolean;
}

export function blankArcDiag(): ArcDiag {
  return {
    usedFallback: false,
    fallbackStage: "none",
    fallbackSignedWith: "public",
    fallbackRequestMode: "none",
    refetchedLoginWbi: false,
  };
}

function normalizeLoginWbiResult(result: WbiKeys | LoginWbiResult): LoginWbiResult {
  if ("keys" in result) return result;
  return { keys: result };
}

function normalizeBrowserJsonResult(result: unknown | BrowserJsonResult): BrowserJsonResult {
  if (
    typeof result === "object" &&
    result !== null &&
    "body" in result &&
    "mode" in result
  ) {
    return result as BrowserJsonResult;
  }
  return { body: result, mode: "context.request" };
}

/** 注入式依赖：把网络/浏览器细节留给 bilibili-net，本函数只编排回退决策，便于纯测试。 */
export interface ArcFallbackDeps {
  getKeys: () => Promise<WbiKeys>;
  /** 用登录态浏览器重新取 WBI keys（可选；-352 回退时更稳）。 */
  getKeysViaBrowser?: () => Promise<WbiKeys | LoginWbiResult>;
  /** 由 keys 生成已签名的 arc/search URL。 */
  sign: (keys: WbiKeys) => string;
  nodeGet: (url: string) => Promise<unknown>;
  browserGet: (url: string) => Promise<unknown | BrowserJsonResult>;
  hasLoginProfile: boolean;
}

/**
 * 公开直连请求 + 解析；若抛 needsAuth 错误且有登录态，则：
 *  (可选)登录态浏览器重取 WBI keys → 重签 → 登录态浏览器请求 → 再解析。
 * 全程把诊断写入 diag。成功返回解析结果；终态失败抛出（diag 已记录前后 code）。
 */
export async function runArcSearchWithFallback(
  deps: ArcFallbackDeps,
  diag: ArcDiag,
): Promise<ArcSearchParsed> {
  const keys = await deps.getKeys();
  const url = deps.sign(keys);

  let gotJson = false;
  try {
    const json = await deps.nodeGet(url);
    gotJson = true;
    const cm = readCodeMsg(json);
    diag.firstApiCode = cm.code;
    diag.firstApiMessage = cm.message;
    return parseArcSearch(json); // -352 在这里抛
  } catch (e) {
    if (!gotJson && e instanceof BiliApiError) {
      diag.firstApiCode = e.code; // 如 HTTP 412
      diag.firstApiMessage = e.message;
    }
    diag.fallbackStage = gotJson ? "parse_response" : "node_request";
    const needsAuth = e instanceof BiliApiError && e.needsAuth;
    if (!needsAuth || !deps.hasLoginProfile) throw e; // 不满足回退条件：原样抛出

    diag.usedFallback = true;
    let loginUrl = url;
    if (deps.getKeysViaBrowser) {
      try {
        const lk = normalizeLoginWbiResult(await deps.getKeysViaBrowser());
        loginUrl = deps.sign(lk.keys);
        diag.refetchedLoginWbi = true;
        diag.fallbackSignedWith = "login";
        diag.fallbackNavCode = lk.navCode;
        diag.fallbackNavIsLogin = lk.navIsLogin;
      } catch {
        /* 取不到登录态 keys 就沿用原签名 URL */
      }
    }
    const browserResult = normalizeBrowserJsonResult(await deps.browserGet(loginUrl));
    diag.fallbackRequestMode = browserResult.mode;
    diag.fallbackContextRequestCode = browserResult.contextRequestCode;
    diag.fallbackContextRequestMessage = browserResult.contextRequestMessage;
    diag.fallbackPageEvaluateCode = browserResult.pageEvaluateCode;
    diag.fallbackPageEvaluateMessage = browserResult.pageEvaluateMessage;
    const fjson = browserResult.body;
    const fcm = readCodeMsg(fjson);
    diag.fallbackApiCode = fcm.code;
    diag.fallbackApiMessage = fcm.message;
    return parseArcSearch(fjson); // 回退后仍可能抛（diag 已记录两次 code）
  }
}
