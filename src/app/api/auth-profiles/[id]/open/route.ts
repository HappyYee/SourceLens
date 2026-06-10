import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSafeProfileDir } from "@/lib/authprofile";
import { openLoginWindow } from "@/lib/browser";
import {
  networkHint,
  resolveRefreshNetwork,
  type ProxyMode,
  type RefreshRegion,
} from "@/lib/network";

export const runtime = "nodejs"; // Playwright 需 Node runtime，绝不能用 edge
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 打开登录窗口（headless=false，本机 Chrome）。仅 Mac 上可用。
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ap = await prisma.authProfile.findUnique({ where: { id: params.id } });
  if (!ap) return NextResponse.json({ error: "登录态不存在" }, { status: 404 });
  if (!isSafeProfileDir(ap.profileDir)) {
    return NextResponse.json({ error: "profileDir 不安全，已阻止" }, { status: 400 });
  }

  const net = resolveRefreshNetwork({
    platform: ap.platform,
    refreshRegion: ap.refreshRegion as RefreshRegion,
    proxyMode: ap.proxyMode as ProxyMode,
    proxyUrl: ap.proxyUrl,
  });

  try {
    await openLoginWindow({
      platform: ap.platform,
      profileDir: ap.profileDir,
      proxyUrl: net.shouldUseProxy ? net.proxyUrl : undefined,
    });
    return NextResponse.json({
      ok: true,
      networkLabel: net.humanLabel,
      message: `已打开 ${ap.platform} 登录窗口（${net.humanLabel}）。在窗口里登录后，回来点"检查登录状态"。`,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, networkLabel: net.humanLabel, error, hint: networkHint(net.region, error) },
      { status: 500 },
    );
  }
}
