import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 清空全部数据（rooms / bindings / items）。危险操作。
export async function DELETE() {
  await prisma.item.deleteMany();
  await prisma.sourceBinding.deleteMany();
  await prisma.room.deleteMany();
  return NextResponse.json({ ok: true });
}
