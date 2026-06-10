import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSafeProfileDir } from "@/lib/authprofile";
import { diagnose } from "@/lib/browser";

export const runtime = "nodejs"; // Playwright 需 Node runtime
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 登录态环境自检：能否 import playwright-core / 本机 Chrome 是否可用 / profile 目录是否可写。
// 不读取、不打印 cookie，不返回任何敏感信息。
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ap = await prisma.authProfile.findUnique({ where: { id: params.id } });
  if (!ap) return NextResponse.json({ error: "登录态不存在" }, { status: 404 });
  if (!isSafeProfileDir(ap.profileDir)) {
    return NextResponse.json({ error: "profileDir 不安全，已阻止" }, { status: 400 });
  }
  const d = await diagnose(ap.profileDir);
  return NextResponse.json(d);
}
