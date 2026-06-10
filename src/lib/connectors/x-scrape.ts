// X 抓取层（仅 Next 运行时；不被 node --test 导入）。
// 用 x 登录态打开用户主页，拦截 UserTweets GraphQL 响应，低频滚动加载更多 →
// 交给纯解析器映射。只读：不点赞 / 不转发 / 不评论 / 不关注 / 不发推 / 不私信 / 不下载视频文件。
import { withProfileContext } from "../browser";
import { parseUserTweets, filterTweets, mapTweet, type XFilterOptions } from "./xpost";
import type { NormalizedItem } from "../normalize";

interface PwResponse {
  url: () => string;
  json: () => Promise<unknown>;
}
interface PwPage {
  on: (ev: "response", h: (r: PwResponse) => void) => void;
  goto: (url: string, opts?: unknown) => Promise<unknown>;
  url: () => string;
  evaluate: <T>(fn: (...a: unknown[]) => T, arg?: unknown) => Promise<T>;
  waitForTimeout: (ms: number) => Promise<void>;
}

const MAX_SCROLLS = 40;
const SCROLL_WAIT = 1600; // 低频
const STAGNANT_STOP = 3;

export interface XScrapeResult {
  videos: NormalizedItem[]; // 命名沿用，便于 fetcher 复用
  scannedCount: number; // 解析到的去重前原始条数
  scrolls: number;
}

/** 抓取某 X 用户主页 posts，最多 targetCount 条（去重、按时间倒序）。 */
export async function scrapeXUser(opts: {
  handle: string;
  profileDir: string;
  proxyUrl?: string;
  targetCount: number;
  filter?: XFilterOptions;
}): Promise<XScrapeResult> {
  const { handle, profileDir, proxyUrl, targetCount, filter } = opts;

  return withProfileContext({ profileDir, proxyUrl }, async (rawPage) => {
    const page = rawPage as unknown as PwPage;
    const payloads: unknown[] = [];

    page.on("response", (resp) => {
      const url = resp.url();
      if (/\/graphql\/[^/]+\/(UserTweets|UserTweetsAndReplies|UserMedia)\b/.test(url)) {
        resp
          .json()
          .then((j) => payloads.push(j))
          .catch(() => {});
      }
    });

    await page.goto(`https://x.com/${handle}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

    if (/\/(i\/flow\/login|login)\b/i.test(page.url())) {
      throw new Error("未登录或登录态失效：请在设置页打开 X 登录窗口重新登录");
    }

    // 收敛函数：解析当前所有 payload，去重 + 过滤。
    const collect = (): NormalizedItem[] => {
      const seen = new Set<string>();
      const all: NormalizedItem[] = [];
      for (const p of payloads) {
        for (const t of filterTweets(parseUserTweets(p), filter)) {
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          all.push(mapTweet(t));
        }
      }
      return all;
    };

    // 等首批 XHR
    await page.waitForTimeout(2500);

    let scrolls = 0;
    let lastLen = 0;
    let stagnant = 0;
    while (scrolls < MAX_SCROLLS) {
      const cur = collect();
      if (cur.length >= targetCount) break;
      if (cur.length === lastLen) {
        stagnant += 1;
        if (stagnant >= STAGNANT_STOP) break; // 连续多次没有新内容 → 到底/被限速
      } else {
        stagnant = 0;
      }
      lastLen = cur.length;
      await page.evaluate(() => {
        // 在浏览器上下文里滚动
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(SCROLL_WAIT);
      scrolls += 1;
    }

    const rawAll = payloads.flatMap((p) => parseUserTweets(p));
    const final = collect().slice(0, targetCount);
    return { videos: final, scannedCount: rawAll.length, scrolls };
  });
}
