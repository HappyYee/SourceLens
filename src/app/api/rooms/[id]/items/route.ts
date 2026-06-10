import { NextResponse } from "next/server";
import { getRoomById } from "@/lib/data";

export const dynamic = "force-dynamic";

// 该 Room 的合并时间线（仅本 Room 绑定）。支持 ?before=ISO 回溯翻页、?take=N。
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const url = new URL(req.url);
  const beforeStr = url.searchParams.get("before");
  const takeStr = url.searchParams.get("take");

  const before = beforeStr ? new Date(beforeStr) : undefined;
  const take = takeStr ? Math.min(500, Math.max(1, Number(takeStr) || 100)) : 200;

  const room = await getRoomById(params.id, { before, take });
  if (!room) return NextResponse.json({ error: "Room 不存在" }, { status: 404 });

  return NextResponse.json({ room: { id: room.id, name: room.name }, items: room.items });
}
