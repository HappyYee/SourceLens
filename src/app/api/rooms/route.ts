import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clampImportance } from "@/lib/validate";

export const dynamic = "force-dynamic";

// 取全部 Room（扁平，含绑定）
export async function GET() {
  const rooms = await prisma.room.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { bindings: true },
  });
  return NextResponse.json({ rooms });
}

// 新建节点：nodeKind=folder(分区) 或 room(内容房间)。父级必须是 folder。
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name 必填" }, { status: 400 });
  }
  const nodeKind = body.nodeKind === "folder" ? "folder" : "room";
  const type =
    nodeKind === "folder"
      ? null
      : typeof body.type === "string" && body.type.trim()
        ? body.type.trim()
        : "person";

  const parentId: string | null = body.parentId ?? null;
  if (parentId) {
    const parent = await prisma.room.findUnique({
      where: { id: parentId },
      select: { nodeKind: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "父级不存在" }, { status: 400 });
    }
    if (parent.nodeKind !== "folder") {
      return NextResponse.json({ error: "父级必须是分区(folder)" }, { status: 400 });
    }
  }

  const siblingCount = await prisma.room.count({ where: { parentId } });
  const room = await prisma.room.create({
    data: {
      name: body.name.trim(),
      nodeKind,
      type,
      importance: clampImportance(body.importance),
      parentId,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : siblingCount,
    },
  });
  return NextResponse.json({ room }, { status: 201 });
}
