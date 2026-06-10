import { NextResponse } from "next/server";
import { rmSync } from "node:fs";
import { prisma } from "@/lib/db";
import { isSafeProfileDir } from "@/lib/authprofile";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "body 无效" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (["none", "system", "manual"].includes(body.proxyMode)) data.proxyMode = body.proxyMode;
  if (body.proxyUrl !== undefined)
    data.proxyUrl = typeof body.proxyUrl === "string" ? body.proxyUrl : null;
  if (["domestic", "foreign", "auto"].includes(body.refreshRegion))
    data.refreshRegion = body.refreshRegion;

  try {
    const authProfile = await prisma.authProfile.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ authProfile });
  } catch {
    return NextResponse.json({ error: "登录态不存在" }, { status: 404 });
  }
}

// 删除登录态：删 DB 行 + 仅删其专用 profile 目录（绝不动 data/db）。
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ap = await prisma.authProfile.findUnique({ where: { id: params.id } });
  if (!ap) return NextResponse.json({ error: "登录态不存在" }, { status: 404 });
  try {
    if (isSafeProfileDir(ap.profileDir)) {
      rmSync(ap.profileDir, { recursive: true, force: true });
    }
  } catch {
    // 目录删除失败不阻塞 DB 删除
  }
  await prisma.authProfile.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
