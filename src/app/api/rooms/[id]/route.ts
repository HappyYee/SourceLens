import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clampImportance } from "@/lib/validate";

export const dynamic = "force-dynamic";

// 把 newParentId 设为 roomId 的父级是否会成环（newParent 是 room 的后代）
async function wouldCreateCycle(
  roomId: string,
  newParentId: string,
): Promise<boolean> {
  let cur: string | null = newParentId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === roomId) return true;
    if (seen.has(cur)) break;
    seen.add(cur);
    const r: { parentId: string | null } | null = await prisma.room.findUnique({
      where: { id: cur },
      select: { parentId: true },
    });
    cur = r?.parentId ?? null;
  }
  return false;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "body 无效" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.importance !== undefined) data.importance = clampImportance(body.importance);
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;
  if (body.nodeKind === "folder" || body.nodeKind === "room") data.nodeKind = body.nodeKind;
  if (data.nodeKind === "folder") {
    data.type = null; // folder 无 roomType
  } else if (body.type !== undefined) {
    data.type =
      typeof body.type === "string" && body.type.trim() ? body.type.trim() : null;
  }

  if (body.parentId !== undefined) {
    const newParent: string | null = body.parentId;
    if (newParent === params.id) {
      return NextResponse.json({ error: "不能嵌套到自身" }, { status: 400 });
    }
    if (newParent && (await wouldCreateCycle(params.id, newParent))) {
      return NextResponse.json({ error: "不能嵌套到自己的子孙（会成环）" }, { status: 400 });
    }
    if (newParent) {
      const parent = await prisma.room.findUnique({
        where: { id: newParent },
        select: { nodeKind: true },
      });
      if (!parent) {
        return NextResponse.json({ error: "父级不存在" }, { status: 400 });
      }
      if (parent.nodeKind !== "folder") {
        return NextResponse.json({ error: "父级必须是分区(folder)" }, { status: 400 });
      }
    }
    data.parentId = newParent;
  }

  try {
    const room = await prisma.room.update({ where: { id: params.id }, data });
    return NextResponse.json({ room });
  } catch {
    return NextResponse.json({ error: "Room 不存在" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const room = await prisma.room.findUnique({
    where: { id: params.id },
    select: { parentId: true },
  });
  if (!room) return NextResponse.json({ error: "Room 不存在" }, { status: 404 });

  try {
    // 事务：子 room 先上提到本 room 的父级（避免自引用 FK 失败 / 数据丢失），
    // 再删本 room —— 其 bindings / items 通过 onDelete: Cascade 一并清除。
    await prisma.$transaction([
      prisma.room.updateMany({
        where: { parentId: params.id },
        data: { parentId: room.parentId },
      }),
      prisma.room.delete({ where: { id: params.id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "删除失败" },
      { status: 500 },
    );
  }
}
