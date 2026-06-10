import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { detectPlatform } from "@/lib/validate";
import { ruleTitle } from "@/lib/ai/title";

export const dynamic = "force-dynamic";

// 手动粘贴单条链接。body: { roomId, url, text?, title?, publishedAt? }
// 平台按 URL 自动识别（youtube/x/github/manual）；条目挂在该 Room 的"手动粘贴"来源桶里。
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.roomId !== "string" ||
    typeof body.url !== "string" ||
    !body.url.trim()
  ) {
    return NextResponse.json({ error: "roomId 与 url 必填" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { id: body.roomId } });
  if (!room) return NextResponse.json({ error: "Room 不存在" }, { status: 404 });

  const url = body.url.trim();
  const itemPlatform = detectPlatform(url); // 关键修复：按 URL 识别，不再硬编码 x

  // 所有手动条目挂在同一个 platform=manual 的"手动粘贴"桶里（不污染真实 source 列表）。
  let binding = await prisma.sourceBinding.findFirst({
    where: { roomId: body.roomId, platform: "manual" },
  });
  if (!binding) {
    binding = await prisma.sourceBinding.create({
      data: { roomId: body.roomId, platform: "manual", label: "手动粘贴", enabled: true },
    });
  }

  const pub = body.publishedAt ? new Date(body.publishedAt) : new Date();
  const title =
    typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const excerpt = text ? text.slice(0, 200) : null;
  const aiTitle = !title && text ? ruleTitle(text) : null;
  const titleSource = title ? "original" : aiTitle ? "rule" : null;

  try {
    const item = await prisma.item.create({
      data: {
        bindingId: binding.id,
        roomId: body.roomId,
        platform: itemPlatform, // 条目平台 = URL 识别结果
        externalId: url, // 用 URL 去重
        title,
        aiTitle,
        titleSource,
        excerpt,
        url,
        publishedAt: Number.isNaN(+pub) ? new Date() : pub,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "该链接已存在（去重）" }, { status: 409 });
  }
}
