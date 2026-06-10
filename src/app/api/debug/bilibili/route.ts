import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { diagnoseBilibili } from "@/lib/connectors/bilibili-net";
import { resolveRefreshNetwork, type ProxyMode, type RefreshRegion } from "@/lib/network";

export const runtime = "nodejs"; // 可能用到 Playwright 登录态回退
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Bilibili 抓取自检：输入 mid / space URL，跑完整流程并逐阶段返回失败点。不打印 cookie。
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const input = typeof body?.input === "string" ? body.input.trim() : "";
  if (!input) return NextResponse.json({ error: "请提供 mid 或 space.bilibili.com 链接" }, { status: 400 });

  // 用 bilibili 登录态（若有）做回退；通道按 AuthProfile 解析（默认国内直连、不走代理）。
  const ap = await prisma.authProfile.findFirst({
    where: { platform: "bilibili" },
    orderBy: { createdAt: "asc" },
  });
  const net = resolveRefreshNetwork({
    platform: "bilibili",
    refreshRegion: (ap?.refreshRegion as RefreshRegion) ?? "auto",
    proxyMode: (ap?.proxyMode as ProxyMode) ?? "none",
    proxyUrl: ap?.proxyUrl ?? undefined,
  });

  const report = await diagnoseBilibili(input, {
    useProxy: net.shouldUseProxy,
    proxyUrl: net.shouldUseProxy ? net.proxyUrl : undefined,
    profileDir: ap?.profileDir,
  });
  return NextResponse.json({
    ...report,
    networkLabel: net.humanLabel,
    hasLoginProfile: !!ap?.profileDir,
  });
}
