import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSafeProfileDir } from "@/lib/authprofile";
import { checkLoginStatus } from "@/lib/browser";
import { checkBilibiliLogin, type BiliLoginDetail } from "@/lib/connectors/bilibili-net";
import {
  formatOutcome,
  networkHint,
  resolveRefreshNetwork,
  type ProxyMode,
  type RefreshOutcome,
  type RefreshRegion,
} from "@/lib/network";

export const runtime = "nodejs"; // Playwright 需 Node runtime，绝不能用 edge
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 轻量检查登录状态。返回统一结果（含 networkLabel），并写回 status / lastResult。
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ap = await prisma.authProfile.findUnique({ where: { id: params.id } });
  if (!ap) return NextResponse.json({ error: "登录态不存在" }, { status: 404 });

  const net = resolveRefreshNetwork({
    platform: ap.platform,
    refreshRegion: ap.refreshRegion as RefreshRegion,
    proxyMode: ap.proxyMode as ProxyMode,
    proxyUrl: ap.proxyUrl,
  });
  const base = {
    action: "check_auth" as const,
    platform: ap.platform,
    refreshRegion: ap.refreshRegion as RefreshRegion,
    networkLabel: net.humanLabel,
  };

  if (!isSafeProfileDir(ap.profileDir)) {
    const o: RefreshOutcome = { ...base, ok: false, error: "profileDir 不安全，已阻止" };
    await prisma.authProfile.update({
      where: { id: ap.id },
      data: { lastResult: formatOutcome(o), lastCheckedAt: new Date() },
    });
    return NextResponse.json(o, { status: 400 });
  }

  try {
    let status: "logged_in" | "expired" | "needs_check";
    let debug: BiliLoginDetail | undefined;
    if (ap.platform === "bilibili") {
      const r = await checkBilibiliLogin(
        ap.profileDir,
        net.shouldUseProxy ? net.proxyUrl : undefined,
      );
      status = r.status;
      debug = r.detail; // 含 checkedUrl / httpStatus / navCode / isLogin / redirectedToLogin / note
    } else {
      const r = await checkLoginStatus({
        platform: ap.platform,
        profileDir: ap.profileDir,
        proxyUrl: net.shouldUseProxy ? net.proxyUrl : undefined,
      });
      status = r.status;
    }
    const ok = status === "logged_in";
    const error = ok
      ? undefined
      : status === "expired"
        ? debug?.note
          ? `登录已失效：${debug.note}`
          : "登录已失效，请重新打开登录窗口登录"
        : debug?.note
          ? `无法确认：${debug.note}`
          : "无法确认登录状态，请稍后重试";
    const o: RefreshOutcome = {
      ...base,
      ok,
      error,
      hint: ok ? undefined : networkHint(net.region, error),
    };
    await prisma.authProfile.update({
      where: { id: ap.id },
      data: { status, lastResult: formatOutcome(o), lastCheckedAt: new Date() },
    });
    return NextResponse.json({ ...o, debug });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const o: RefreshOutcome = { ...base, ok: false, error, hint: networkHint(net.region, error) };
    await prisma.authProfile.update({
      where: { id: ap.id },
      data: { status: "needs_check", lastResult: formatOutcome(o), lastCheckedAt: new Date() },
    });
    return NextResponse.json(o, { status: 500 });
  }
}
