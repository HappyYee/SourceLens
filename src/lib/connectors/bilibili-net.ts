// Bilibili 网络层（仅 Next 运行时；不被 node --test 导入）。
// 策略：先用 Node fetch（直连/按通道走代理）打 WBI 签名 API；遇到风控(含 HTTP 412 / body -352/-101/-403)
// 且有 bilibili 登录态时，回退到 Playwright 持久化上下文（浏览器自带 cookie 鉴权；不读取 / 不打印 cookie）。
// 真实刷新与自检共用 runArcSearchWithFallback，避免回退逻辑分叉。
import {
  encWbi,
  imgSubKeyFromNav,
  parseNavIsLogin,
  readCodeMsg,
  mapArchive,
  mapArchives,
  parseBilibiliInput,
  runArcSearchWithFallback,
  blankArcDiag,
  BiliApiError,
  type ArcFallbackDeps,
  type ArcSearchParsed,
  type BiliArchive,
  type BrowserJsonResult,
  type FallbackStage,
  type LoginWbiResult,
  type WbiKeys,
} from "./bilibili";
import { withProfileContext } from "../browser";
import { directDispatcher, proxyDispatcher } from "../proxy";
import type { Dispatcher } from "undici";
import type { NormalizedItem } from "../normalize";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const NAV_URL = "https://api.bilibili.com/x/web-interface/nav";

export interface BiliChannel {
  useProxy: boolean;
  proxyUrl?: string;
  profileDir?: string; // 有则允许浏览器回退 / 登录态检查
}

type FetchInit = RequestInit & { dispatcher?: Dispatcher };
type JsonResponseLike = {
  status?: () => number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
};
type RequestContextLike = {
  get: (url: string, opts?: { headers?: Record<string, string>; timeout?: number }) => Promise<JsonResponseLike>;
};

function dispatcherFor(ch: BiliChannel): Dispatcher {
  return ch.useProxy && ch.proxyUrl ? proxyDispatcher(ch.proxyUrl) : directDispatcher();
}

function biliHeaders(referer: string): Record<string, string> {
  return {
    "user-agent": UA,
    referer,
    origin: "https://space.bilibili.com",
    accept: "application/json, text/plain, */*",
  };
}

async function responseToJson(resp: JsonResponseLike | null): Promise<unknown> {
  if (!resp) return {};
  if (resp.json) {
    try {
      return await resp.json();
    } catch {
      /* 落到 text */
    }
  }
  if (resp.text) {
    const text = await resp.text().catch(() => "");
    try {
      return JSON.parse(text || "{}");
    } catch {
      return {};
    }
  }
  return {};
}

/** Node 直连取 JSON。HTTP 412 视为风控 → 抛 BiliApiError(-412) 以触发登录态回退。 */
async function nodeGetJson(url: string, referer: string, ch: BiliChannel): Promise<unknown> {
  const init: FetchInit = {
    headers: {
      ...biliHeaders(referer),
    },
    signal: AbortSignal.timeout(20_000),
    dispatcher: dispatcherFor(ch),
  };
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && (e.name === "TimeoutError" || /timeout|aborted|connect/i.test(m))) {
      throw new Error("请求超时：B 站未响应（国内刷新一般无需代理，请检查本机网络）");
    }
    throw new Error(`网络错误：${m}`);
  }
  if (res.status === 412) {
    // 用 BiliApiError(-412) 表达，便于上层统一触发登录态回退
    throw new BiliApiError(-412, "B 站风控拦截（HTTP 412）：请放慢频率，或用 bilibili 登录态后重试");
  }
  if (!res.ok) throw new Error(`B 站 HTTP ${res.status}`);
  return res.json().catch(() => ({}));
}

/** 登录态浏览器请求 JSON：使用 context.request，浏览器上下文自带 cookie。 */
async function browserRequestJson(
  url: string,
  ch: BiliChannel,
  referer: string,
): Promise<unknown> {
  if (!ch.profileDir) {
    throw new Error("需要登录：请在设置页创建 bilibili 登录态并登录后重试");
  }
  return withProfileContext(
    { profileDir: ch.profileDir, proxyUrl: ch.useProxy ? ch.proxyUrl : undefined, userAgent: UA },
    async (_page, ctx) => {
      const request = (ctx as unknown as { request?: RequestContextLike }).request;
      if (!request?.get) throw new Error("Playwright context.request 不可用");
      const resp = await request.get(url, { headers: biliHeaders(referer), timeout: 25_000 });
      return responseToJson(resp);
    },
  );
}

/** 登录态 fallback：优先 context.request；仍失败时打开真实 space 页并 page.evaluate(fetch)。 */
async function browserGetArcJson(
  url: string,
  mid: string,
  ch: BiliChannel,
): Promise<BrowserJsonResult> {
  if (!ch.profileDir) {
    throw new Error("需要登录：请在设置页创建 bilibili 登录态并登录后重试");
  }
  const referer = `https://space.bilibili.com/${mid}/video`;
  return withProfileContext(
    { profileDir: ch.profileDir, proxyUrl: ch.useProxy ? ch.proxyUrl : undefined, userAgent: UA },
    async (page, ctx) => {
      let contextJson: unknown = null;
      let contextRequestCode: number | undefined;
      let contextRequestMessage: string | undefined;
      let pagePrepared = false;
      const request = (ctx as unknown as { request?: RequestContextLike }).request;

      await page.goto(referer, { waitUntil: "domcontentloaded", timeout: 25_000 }).catch(() => {});
      await page.waitForTimeout(800);
      pagePrepared = true;

      if (request?.get) {
        try {
          await request
            .get(NAV_URL, { headers: biliHeaders("https://www.bilibili.com/"), timeout: 25_000 })
            .catch(() => null);
          const resp = await request.get(url, { headers: biliHeaders(referer), timeout: 25_000 });
          contextJson = await responseToJson(resp);
          const cm = readCodeMsg(contextJson);
          contextRequestCode = cm.code;
          contextRequestMessage = cm.message;
          if (cm.code === 0) {
            return {
              body: contextJson,
              mode: "context.request",
              contextRequestCode,
              contextRequestMessage,
            };
          }
        } catch (e) {
          contextRequestMessage = e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160);
        }
      } else {
        contextRequestMessage = "Playwright context.request 不可用";
      }

      try {
        if (!pagePrepared) {
          await page.goto(referer, { waitUntil: "domcontentloaded", timeout: 25_000 }).catch(() => {});
          await page.waitForTimeout(1200);
        }
        const pageJson = await page.evaluate<unknown>(
          async (requestUrl) => {
            const res = await fetch(String(requestUrl), {
              method: "GET",
              credentials: "include",
              headers: { accept: "application/json, text/plain, */*" },
            });
            const text = await res.text();
            try {
              return JSON.parse(text || "{}");
            } catch {
              return { code: -1, message: "page.evaluate fetch 返回非 JSON" };
            }
          },
          url,
        );
        const pageCm = readCodeMsg(pageJson);
        return {
          body: pageJson,
          mode: "page.evaluate",
          contextRequestCode,
          contextRequestMessage,
          pageEvaluateCode: pageCm.code,
          pageEvaluateMessage: pageCm.message,
        };
      } catch (e) {
        const pageEvaluateMessage = e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160);
        if (contextJson) {
          return {
            body: contextJson,
            mode: "context.request",
            contextRequestCode,
            contextRequestMessage,
            pageEvaluateMessage,
          };
        }
        return {
          body: { code: -1, message: pageEvaluateMessage },
          mode: "page.evaluate",
          contextRequestCode,
          contextRequestMessage,
          pageEvaluateMessage,
        };
      }
    },
  );
}

// nav 提供 WBI 的 img_key/sub_key（全站通用），缓存 6 小时。Node 风控时用登录态浏览器取。
let wbiCache: { keys: WbiKeys; at: number } | null = null;
const WBI_TTL = 6 * 60 * 60 * 1000;

async function getWbiKeys(ch: BiliChannel): Promise<WbiKeys> {
  if (wbiCache && Date.now() - wbiCache.at < WBI_TTL) return wbiCache.keys;
  let nav: unknown;
  try {
    nav = await nodeGetJson(NAV_URL, "https://www.bilibili.com/", ch);
  } catch (e) {
    if (e instanceof BiliApiError && e.needsAuth && ch.profileDir) {
      nav = await browserRequestJson(NAV_URL, ch, "https://www.bilibili.com/");
    } else {
      throw e;
    }
  }
  const keys = imgSubKeyFromNav(nav);
  if (!keys.imgKey || !keys.subKey) throw new Error("无法获取 B 站 WBI 签名密钥（nav 解析失败）");
  wbiCache = { keys, at: Date.now() };
  return keys;
}

/** 用登录态浏览器重新取 WBI keys（-352 回退时更稳）。 */
async function getKeysViaBrowser(ch: BiliChannel): Promise<LoginWbiResult> {
  const nav = await browserRequestJson(NAV_URL, ch, "https://www.bilibili.com/");
  const keys = imgSubKeyFromNav(nav);
  if (!keys.imgKey || !keys.subKey) throw new Error("登录态 nav 解析 WBI 失败");
  const login = parseNavIsLogin(nav);
  return { keys, navCode: login.code, navIsLogin: login.isLogin };
}

function arcSearchUrl(mid: string, pn: number, ps: number, keys: WbiKeys): string {
  const { query } = encWbi(
    { mid, pn, ps, order: "pubdate", platform: "web", web_location: "1550101" },
    keys.imgKey,
    keys.subKey,
  );
  return `https://api.bilibili.com/x/space/wbi/arc/search?${query}`;
}

/** 为某 mid/pn/ps/通道装配 arc/search 回退依赖。 */
function arcDeps(mid: string, pn: number, ps: number, ch: BiliChannel): ArcFallbackDeps {
  const referer = `https://space.bilibili.com/${mid}/video`;
  return {
    getKeys: () => getWbiKeys(ch),
    getKeysViaBrowser: ch.profileDir ? () => getKeysViaBrowser(ch) : undefined,
    sign: (keys) => arcSearchUrl(mid, pn, ps, keys),
    nodeGet: (url) => nodeGetJson(url, referer, ch),
    browserGet: (url) => browserGetArcJson(url, mid, ch),
    hasLoginProfile: !!ch.profileDir,
  };
}

/** 取一页投稿（公开直连 + 解析阶段风控回退，统一编排）。 */
async function fetchPage(
  mid: string,
  pn: number,
  ps: number,
  ch: BiliChannel,
): Promise<{ items: BiliArchive[]; total: number; usedFallback: boolean }> {
  const diag = blankArcDiag();
  const parsed: ArcSearchParsed = await runArcSearchWithFallback(arcDeps(mid, pn, ps, ch), diag);
  return { items: parsed.items, total: parsed.total, usedFallback: diag.usedFallback };
}

export interface BiliCollectResult {
  videos: NormalizedItem[];
  fetchedCount: number;
  pageCount: number;
  hasMore: boolean;
  upName: string;
}

const PAGE_SIZE = 50;
const MAX_PAGES = 40; // 安全上限（2000 条）

/** 按发布时间倒序收集 UP 投稿，直到达到 limit 或没有更多。刷新最新 / 回溯共用。 */
export async function collectBilibiliArchives(opts: {
  mid: string;
  limit: number;
  channel: BiliChannel;
}): Promise<BiliCollectResult> {
  const { mid, limit, channel } = opts;
  const raw: BiliArchive[] = [];
  let total = 0;
  let pageCount = 0;
  let upName = "";

  for (let pn = 1; pn <= MAX_PAGES; pn++) {
    const { items, total: t } = await fetchPage(mid, pn, PAGE_SIZE, channel);
    total = t;
    pageCount++;
    if (items.length && !upName) upName = String(items[0].author ?? "");
    raw.push(...items);
    if (raw.length >= limit) break;
    if (items.length < PAGE_SIZE) break;
    if (raw.length >= total && total > 0) break;
  }

  const sliced = raw.slice(0, limit);
  const videos = mapArchives(sliced, upName || undefined);
  const hasMore = total > 0 ? sliced.length < total : raw.length > sliced.length;
  return { videos, fetchedCount: sliced.length, pageCount, hasMore, upName };
}

/* ------------------------------ 登录态检查（nav） ------------------------------ */

export interface BiliLoginDetail {
  checkedUrl: string;
  httpStatus?: number;
  navCode?: number;
  isLogin?: boolean;
  redirectedToLogin?: boolean;
  timedOut?: boolean;
  profileBusy?: boolean;
  note?: string; // 非敏感说明
}
export interface BiliLoginCheck {
  status: "logged_in" | "expired" | "needs_check";
  detail: BiliLoginDetail;
}

const PROFILE_BUSY_RE = /SingletonLock|ProcessSingleton|in use|already running|cannot create/i;

/**
 * 用 bilibili 登录态打开 nav 接口判断是否登录（确定性信号，胜过抓首页头像）。
 * 不读取 / 不打印 cookie；不返回 uname / mid 等账号信息。
 */
export async function checkBilibiliLogin(
  profileDir: string,
  proxyUrl?: string,
): Promise<BiliLoginCheck> {
  try {
    return await withProfileContext({ profileDir, proxyUrl, userAgent: UA }, async (page) => {
      const resp = (await page.goto(NAV_URL, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      })) as { status?: () => number; json?: () => Promise<unknown> } | null;
      const httpStatus = resp?.status?.();
      let json: unknown = {};
      try {
        if (resp?.json) json = await resp.json();
      } catch {
        /* 落到 innerText */
      }
      if (!json || Object.keys(json as object).length === 0) {
        const txt = await page.evaluate<string>(
          () =>
            (globalThis as { document?: { body?: { innerText?: string } } }).document?.body
              ?.innerText ?? "",
        );
        try {
          json = JSON.parse(txt || "{}");
        } catch {
          /* ignore */
        }
      }
      const { isLogin, code } = parseNavIsLogin(json);
      const redirectedToLogin = /passport\.bilibili\.com|\/login/i.test(page.url());
      return {
        status: isLogin ? "logged_in" : "expired",
        detail: {
          checkedUrl: NAV_URL,
          httpStatus,
          navCode: code,
          isLogin,
          redirectedToLogin,
          note: isLogin
            ? "nav.isLogin=true（已登录）"
            : `nav.isLogin=false（code ${code}${redirectedToLogin ? "，被重定向到登录页" : ""}）`,
        },
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const profileBusy = PROFILE_BUSY_RE.test(msg);
    return {
      status: "needs_check",
      detail: {
        checkedUrl: NAV_URL,
        timedOut: /timeout|aborted/i.test(msg),
        profileBusy,
        note: profileBusy
          ? "登录窗口仍在打开或 profile 被占用，请先关闭登录窗口再检查"
          : msg.slice(0, 160),
      },
    };
  }
}

/* ------------------------------ 抓取自检（可观测性） ------------------------------ */

export interface BiliDebugReport {
  input: string;
  mid: string | null;
  stage: string; // 解析 mid / 取 WBI / 请求 / 解析响应 / 完成
  hasLoginProfile: boolean;
  usedLoginFallback: boolean;
  fallbackStage: FallbackStage; // none | node_request | parse_response
  refetchedLoginWbi: boolean;
  wbiOk: boolean;
  firstApiCode?: number;
  firstApiMessage?: string;
  fallbackApiCode?: number;
  fallbackApiMessage?: string;
  fallbackBeforeCode?: number;
  fallbackBeforeMessage?: string;
  fallbackAfterCode?: number;
  fallbackAfterMessage?: string;
  fallbackNavCode?: number;
  fallbackNavIsLogin?: boolean;
  fallbackSignedWith?: "public" | "login";
  fallbackRequestMode?: "none" | "context.request" | "page.evaluate";
  fallbackContextRequestCode?: number;
  fallbackContextRequestMessage?: string;
  fallbackPageEvaluateCode?: number;
  fallbackPageEvaluateMessage?: string;
  fallbackError?: string;
  profileBusy?: boolean;
  videoCount: number;
  firstVideo: { bvid: string; title: string | null; publishedAt: string } | null;
  error?: string;
}

/** 对一个 mid / space URL 跑完整抓取流程并逐阶段记录，给 UI 暴露失败点（不打印 cookie）。 */
export async function diagnoseBilibili(
  input: string,
  channel: BiliChannel,
): Promise<BiliDebugReport> {
  const report: BiliDebugReport = {
    input,
    mid: null,
    stage: "解析 mid",
    hasLoginProfile: !!channel.profileDir,
    usedLoginFallback: false,
    fallbackStage: "none",
    fallbackSignedWith: "public",
    fallbackRequestMode: "none",
    refetchedLoginWbi: false,
    wbiOk: false,
    videoCount: 0,
    firstVideo: null,
  };
  const mid = parseBilibiliInput(input);
  report.mid = mid;
  if (!mid) {
    report.error = "无法解析 mid：请填 mid 或 space.bilibili.com/{mid} 链接";
    return report;
  }

  const diag = blankArcDiag();
  const copyDiag = () => {
    report.usedLoginFallback = diag.usedFallback;
    report.fallbackStage = diag.fallbackStage;
    report.refetchedLoginWbi = diag.refetchedLoginWbi;
    report.firstApiCode = diag.firstApiCode;
    report.firstApiMessage = diag.firstApiMessage;
    report.fallbackApiCode = diag.fallbackApiCode;
    report.fallbackApiMessage = diag.fallbackApiMessage;
    report.fallbackBeforeCode = diag.firstApiCode;
    report.fallbackBeforeMessage = diag.firstApiMessage;
    report.fallbackAfterCode = diag.fallbackApiCode;
    report.fallbackAfterMessage = diag.fallbackApiMessage;
    report.fallbackNavCode = diag.fallbackNavCode;
    report.fallbackNavIsLogin = diag.fallbackNavIsLogin;
    report.fallbackSignedWith = diag.fallbackSignedWith;
    report.fallbackRequestMode = diag.fallbackRequestMode;
    report.fallbackContextRequestCode = diag.fallbackContextRequestCode;
    report.fallbackContextRequestMessage = diag.fallbackContextRequestMessage;
    report.fallbackPageEvaluateCode = diag.fallbackPageEvaluateCode;
    report.fallbackPageEvaluateMessage = diag.fallbackPageEvaluateMessage;
  };

  try {
    report.stage = "取 WBI 签名密钥";
    await getWbiKeys(channel); // 缓存；helper 再取走缓存
    report.wbiOk = true;

    report.stage = "请求 arc/search（公开直连）";
    const parsed = await runArcSearchWithFallback(arcDeps(mid, 1, 30, channel), diag);
    copyDiag();
    report.videoCount = parsed.items.length;
    const first = parsed.items[0] ? mapArchive(parsed.items[0]) : null;
    report.firstVideo = first
      ? { bvid: first.externalId, title: first.title, publishedAt: first.publishedAt.toISOString() }
      : null;
    report.stage = diag.usedFallback ? "完成（登录态回退成功）" : "完成";
    return report;
  } catch (e) {
    copyDiag();
    const msg = e instanceof Error ? e.message : String(e);
    report.profileBusy = PROFILE_BUSY_RE.test(msg);
    if (report.profileBusy) {
      report.error = "登录窗口仍在打开或 profile 被占用，请先关闭登录窗口再自检";
    } else if (diag.usedFallback && diag.fallbackApiCode != null && diag.fallbackApiCode !== 0) {
      report.fallbackError = msg;
      report.error =
        "登录态回退后仍被 B 站风控/拒绝。请降低刷新频率、确认登录窗口已关闭、重新检查登录态，或稍后重试。";
    } else {
      report.error = msg;
    }
    return report;
  }
}
