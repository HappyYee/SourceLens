import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 导出全部数据为 JSON（rooms + bindings + items）。
export async function GET() {
  const rooms = await prisma.room.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { bindings: true, items: true },
  });
  const body = JSON.stringify(
    { app: "SourceLens", version: "0.1", exportedAt: new Date().toISOString(), rooms },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="sourcelens-export.json"',
    },
  });
}
