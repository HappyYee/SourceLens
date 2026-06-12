import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/rooms/[id]/read-all —— 把该 Room 下全部未读标记为已读。
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const r = await prisma.item.updateMany({
    where: { roomId: params.id, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true, count: r.count });
}
