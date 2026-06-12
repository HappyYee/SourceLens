import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { planSiblingOrder, wouldCreateCycle } from "@/lib/tree-move";

export const dynamic = "force-dynamic";

// POST /api/rooms/[id]/move  body: { parentId: string|null, afterId?: string|null }
// 语义：移入 parentId（null=顶层），放在同级 afterId 之后（缺省=末尾）。
// 约束：父级只能是分区(folder)或顶层；禁止把节点移入自身子树（环）。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body || (body.parentId !== null && typeof body.parentId !== "string")) {
    return NextResponse.json({ error: "body 无效：需要 parentId（string|null）" }, { status: 400 });
  }
  const parentId: string | null = body.parentId;
  const afterId: string | null = typeof body.afterId === "string" ? body.afterId : null;

  const node = await prisma.room.findUnique({ where: { id: params.id } });
  if (!node) return NextResponse.json({ error: "节点不存在" }, { status: 404 });

  if (parentId != null) {
    const parent = await prisma.room.findUnique({ where: { id: parentId } });
    if (!parent) return NextResponse.json({ error: "目标父级不存在" }, { status: 404 });
    if (parent.nodeKind !== "folder") {
      return NextResponse.json({ error: "父级只能是分区（folder）" }, { status: 400 });
    }
    const all = await prisma.room.findMany({ select: { id: true, parentId: true } });
    if (wouldCreateCycle(all, node.id, parentId)) {
      return NextResponse.json({ error: "不能移入自身或其子分区" }, { status: 400 });
    }
  }

  const siblings = await prisma.room.findMany({
    where: { parentId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const order = planSiblingOrder(siblings.map((s) => s.id), node.id, afterId);

  // 统一重排同级 sortOrder（步长 10），movingId 的 parentId 一并落库。
  await prisma.$transaction(
    order.map((id, i) =>
      prisma.room.update({
        where: { id },
        data: id === node.id ? { parentId, sortOrder: (i + 1) * 10 } : { sortOrder: (i + 1) * 10 },
      }),
    ),
  );
  return NextResponse.json({ ok: true, parentId, order });
}
