import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/items/[id]/read  body: { read?: boolean }（默认 true）
// readAt 写入权仅归已读路由（本路由 + read-all）；刷新与 metadata checker 永不写。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const read = body.read !== false;
  try {
    const it = await prisma.item.update({
      where: { id: params.id },
      data: { readAt: read ? new Date() : null },
      select: { id: true, readAt: true },
    });
    return NextResponse.json({ ok: true, id: it.id, readAt: it.readAt });
  } catch {
    return NextResponse.json({ ok: false, error: "条目不存在" }, { status: 404 });
  }
}
