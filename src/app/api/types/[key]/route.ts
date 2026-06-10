import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 改类型显示名 / 图标 / 颜色（key 不允许改，避免已有数据迁移问题）
export async function PATCH(
  req: Request,
  { params }: { params: { key: string } },
) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "body 无效" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.displayName === "string" && body.displayName.trim()) {
    data.displayName = body.displayName.trim();
  }
  if (body.icon !== undefined) data.icon = typeof body.icon === "string" ? body.icon : null;
  if (body.color !== undefined) data.color = typeof body.color === "string" ? body.color : null;
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

  try {
    const type = await prisma.roomType.update({ where: { key: params.key }, data });
    return NextResponse.json({ type });
  } catch {
    return NextResponse.json({ error: "类型不存在" }, { status: 404 });
  }
}

// 删除类型：仅当没有 room 使用时允许（安全优先，不强删）
export async function DELETE(
  _req: Request,
  { params }: { params: { key: string } },
) {
  const usage = await prisma.room.count({
    where: { nodeKind: "room", type: params.key },
  });
  if (usage > 0) {
    return NextResponse.json(
      { error: `有 ${usage} 个 Room 正在使用该类型，请先迁移到其他类型。` },
      { status: 409 },
    );
  }
  try {
    await prisma.roomType.delete({ where: { key: params.key } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "类型不存在" }, { status: 404 });
  }
}
