// SourceLens 专用本机浏览器登录态（Playwright persistent context）。
// 用途：打开可见登录窗口 + 轻量检查登录状态 + 给只读抓取提供已登录上下文。
// 绝不读取 / 打印 cookie；绝不做点赞/关注/评论/转发/投币/私信等写操作。
// 仅在你的 Mac 上运行（需 playwright-core + 本机 Chrome）。
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const HOME: Record<string, string> = {
  x: "https://x.com/home",
  bilibili: "https://www.bilibili.com/",
};

// 真实桌面 Chrome UA，降低风控（仅用于 headless 抓取上下文；可见登录窗口用 Chrome 默认 UA）。
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type BrowserErrorCode =
  | "playwright_import"
  | "chrome_missing"
  | "profile_dir"
  | "launch"
  | "navigate";

/** 带错误分类的浏览器错误：message 已是面向用户的中文文案 + 原始原因。 */
export class BrowserError extends Error {
  code: BrowserErrorCode;
  constructor(code: BrowserErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "BrowserError";
  }
}

// —— 最小类型（避免把 playwright-core 重类型拉进签名；运行时才真正解析包） ——
interface PageLike {
  goto: (url: string, opts?: unknown) => Promise<unknown>;
  url: () => string;
  $: (sel: string) => Promise<unknown>;
  evaluate: <T>(fn: string | ((...a: unknown[]) => T), arg?: unknown) => Promise<T>;
  waitForTimeout: (ms: number) => Promise<void>;
  content: () => Promise<string>;
}
interface BrowserContextLike {
  pages: () => PageLike[];
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
}
interface BrowserLike {
  close: () => Promise<void>;
}
interface ChromiumLike {
  launch: (opts: Record<string, unknown>) => Promise<BrowserLike>;
  launchPersistentContext: (
    dir: string,
    opts: Record<string, unknown>,
  ) => Promise<BrowserContextLike>;
}
interface PwModule {
  chromium: ChromiumLike;
}

/**
 * 静态字面量 import（配合 next.config 的 serverComponentsExternalPackages 外部化）：
 * 构建期被标记为 external、不打进 bundle，运行时由 Node 从 node_modules 解析。
 * 之前用「变量 specifier」导致 webpack 无法外部化、运行时在 bundle 上下文里找不到模块，
 * 才会出现“明明装了却报未安装”。这里把真实 import 错误如实抛出，不再一律归因为“未安装”。
 */
async function loadPlaywright(): Promise<PwModule> {
  try {
    return (await import("playwright-core")) as unknown as PwModule;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new BrowserError(
      "playwright_import",
      `无法加载 playwright-core（import 失败）：${msg}。请确认已 npm install playwright-core，并重启 dev（next.config 改动需要重启）。`,
    );
  }
}

function ensureProfileDir(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, ".sl-write-probe");
    writeFileSync(probe, "ok");
    rmSync(probe, { force: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new BrowserError("profile_dir", `profile 目录不可写：${dir}（${msg}）`);
  }
}

function mapLaunchError(e: unknown): BrowserError {
  const msg = e instanceof Error ? e.message : String(e);
  if (/not found|not installed|no such file|ENOENT|executable doesn'?t exist|Failed to launch|Chromium distribution/i.test(msg)) {
    return new BrowserError(
      "chrome_missing",
      `找不到本机 Chrome（channel=chrome）。请安装 Google Chrome 后重试。原始错误：${msg}`,
    );
  }
  return new BrowserError("launch", `启动浏览器失败：${msg}`);
}

async function launchContext(
  profileDir: string,
  opts: { proxyUrl?: string; headless: boolean; userAgent?: string },
): Promise<BrowserContextLike> {
  ensureProfileDir(profileDir);
  const pw = await loadPlaywright();
  try {
    return await pw.chromium.launchPersistentContext(profileDir, {
      headless: opts.headless,
      channel: "chrome", // 本机 Chrome（独立 userDataDir，不碰你的日常 Default profile）
      viewport: opts.headless ? { width: 1280, height: 900 } : null,
      userAgent: opts.userAgent,
      proxy: opts.proxyUrl ? { server: opts.proxyUrl } : undefined,
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (e) {
    throw mapLaunchError(e);
  }
}

/** 打开可见登录窗口，导航到平台首页，由用户手动登录。窗口保持打开（随 dev 进程存活）。 */
export async function openLoginWindow(p: {
  platform: string;
  profileDir: string;
  proxyUrl?: string;
}): Promise<void> {
  const ctx = await launchContext(p.profileDir, { proxyUrl: p.proxyUrl, headless: false });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page
    .goto(HOME[p.platform] ?? "about:blank", { waitUntil: "domcontentloaded", timeout: 30000 })
    .catch(() => {});
  // 不 close：把窗口留给用户登录。
}

/** 轻量检查登录状态（headless），不抓数据。 */
export async function checkLoginStatus(p: {
  platform: string;
  profileDir: string;
  proxyUrl?: string;
}): Promise<{ status: "logged_in" | "expired" | "needs_check" }> {
  const ctx = await launchContext(p.profileDir, {
    proxyUrl: p.proxyUrl,
    headless: true,
    userAgent: DESKTOP_UA,
  });
  try {
    const page = await ctx.newPage();
    if (p.platform === "x") {
      await page.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 25000 });
      if (/\/(i\/flow\/login|login)/i.test(page.url())) return { status: "expired" };
      const acct = await page.$(
        '[data-testid="SideNav_AccountSwitcher_Button"], [aria-label="Account menu"]',
      );
      return { status: acct ? "logged_in" : "expired" };
    }
    if (p.platform === "bilibili") {
      await page.goto("https://www.bilibili.com/", { waitUntil: "domcontentloaded", timeout: 25000 });
      const loginEntry = await page.$(".header-login-entry, .right-entry__outside .login-entry");
      if (loginEntry) return { status: "expired" };
      const avatar = await page.$(
        ".header-avatar-wrap, .bili-avatar, .header-entry-mini, img.bili-avatar-img",
      );
      return { status: avatar ? "logged_in" : "needs_check" };
    }
    return { status: "needs_check" };
  } finally {
    await ctx.close();
  }
}

/**
 * 用某登录态 profile 打开一个 headless 上下文执行 fn（只读抓取用）。结束后必定关闭。
 * 浏览器自带 cookie 完成鉴权，但 SourceLens 不读取 / 不打印 cookie。
 */
export async function withProfileContext<T>(
  p: { profileDir: string; proxyUrl?: string; userAgent?: string; headless?: boolean },
  fn: (page: PageLike, ctx: BrowserContextLike) => Promise<T>,
): Promise<T> {
  const ctx = await launchContext(p.profileDir, {
    proxyUrl: p.proxyUrl,
    headless: p.headless ?? true,
    userAgent: p.userAgent ?? DESKTOP_UA,
  });
  try {
    const page = await ctx.newPage();
    return await fn(page, ctx);
  } finally {
    await ctx.close();
  }
}

export interface BrowserDiagnostics {
  playwrightImportable: boolean;
  playwrightError?: string;
  chromeAvailable: boolean;
  chromeError?: string;
  profileDirWritable: boolean;
  profileDirError?: string;
  summary: string;
}

/** 自检：能否 import playwright-core / 本机 Chrome 是否可用 / profileDir 是否可写。绝不打印 cookie。 */
export async function diagnose(profileDir: string): Promise<BrowserDiagnostics> {
  const d: BrowserDiagnostics = {
    playwrightImportable: false,
    chromeAvailable: false,
    profileDirWritable: false,
    summary: "",
  };

  // 1) import
  let chromium: ChromiumLike | undefined;
  try {
    const pw = (await import("playwright-core")) as unknown as PwModule;
    chromium = pw.chromium;
    d.playwrightImportable = true;
  } catch (e) {
    d.playwrightError = e instanceof Error ? e.message : String(e);
  }

  // 2) profileDir 可写
  try {
    ensureProfileDir(profileDir);
    d.profileDirWritable = true;
  } catch (e) {
    d.profileDirError = e instanceof BrowserError ? e.message : String(e);
  }

  // 3) Chrome 可用（快速 headless 启动一次性浏览器再关闭，不加载 profile、不访问任何站点）
  if (chromium) {
    try {
      const b = await chromium.launch({ channel: "chrome", headless: true });
      await b.close();
      d.chromeAvailable = true;
    } catch (e) {
      d.chromeError = mapLaunchError(e).message;
    }
  }

  d.summary = d.playwrightImportable && d.chromeAvailable && d.profileDirWritable
    ? "环境就绪：playwright-core 可加载、本机 Chrome 可用、profile 目录可写。"
    : [
        d.playwrightImportable ? "✓ playwright-core 可加载" : "✗ playwright-core 加载失败",
        d.chromeAvailable ? "✓ 本机 Chrome 可用" : "✗ 本机 Chrome 不可用",
        d.profileDirWritable ? "✓ profile 目录可写" : "✗ profile 目录不可写",
      ].join(" · ");

  return d;
}
