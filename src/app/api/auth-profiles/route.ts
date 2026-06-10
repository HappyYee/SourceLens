import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authProfileDir } from "@/lib/authprofile";

export const dynamic = "force-dynamic";

export async function GET() {
  const profiles = await prisma.authProfile.findMany({
    orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ profiles });
}

// 新建登录态。platform 必须是 x / bilibili。profileDir 自动生成（专用目录）。
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const platform = body?.platform;
  if (platform !== "x" && platform !== "bilibili") {
    return NextResponse.json({ error: "platform 必须是 x 或 bilibili" }, { status: 400 });
  }
  const name =
    typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "main";
  const refreshRegion = ["domestic", "foreign", "auto"].includes(body?.refreshRegion)
    ? body.refreshRegion
    : "auto";
  const proxyMode = ["none", "system", "manual"].includes(body?.proxyMode)
    ? body.proxyMode
    : platform === "x"
      ? "system"
      : "none";
  const proxyUrl =
    typeof body?.proxyUrl === "string"
      ? body.proxyUrl
      : platform === "x"
        ? "http://127.0.0.1:33210"
        : null;

  const authProfile = await prisma.authProfile.create({
    data: {
      platform,
      name,
      profileDir: authProfileDir(platform, name),
      proxyMode,
      proxyUrl,
      refreshRegion,
    },
  });
  return NextResponse.json({ authProfile }, { status: 201 });
}
