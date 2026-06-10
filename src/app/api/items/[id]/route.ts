import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 编辑条目：目前用于设置 customTitle（用户自定义标题）。空字符串 → 清除恢复自动标题。
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "body 无效" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.customTitle !== undefined) {
    const v = typeof body.customTitle === "string" ? body.customTitle.trim() : "";
    data.customTitle = v || null;
    data.titleSource = v ? "custom" : null;
  }

  try {
    const item = await prisma.item.update({ where: { id: params.id }, data });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "条目不存在" }, { status: 404 });
  }
}

// 删除单条内容
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.item.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "条目不存在" }, { status: 404 });
  }
}
