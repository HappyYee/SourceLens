import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRoomTypes } from "@/lib/data";
import { uniqueTypeKey } from "@/lib/type-key";

export const dynamic = "force-dynamic";

// 内容类型列表（含使用中的 room 数）
export async function GET() {
  return NextResponse.json({ types: await getRoomTypes() });
}

// 新增内容类型
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  // key 可省略：由显示名自动生成（U3）。显式传入时仍校验格式。
  let key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key && displayName) {
    const existing = await prisma.roomType.findMany({ select: { key: true } });
    key = uniqueTypeKey(displayName, existing.map((t) => t.key));
  }

  if (!/^[a-z0-9_]+$/i.test(key)) {
    return NextResponse.json({ error: "key 仅限字母 / 数字 / 下划线" }, { status: 400 });
  }
  if (key === "folder") {
    return NextResponse.json({ error: "folder 是结构类型，不能作为 roomType" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "displayName 必填" }, { status: 400 });
  }

  const existing = await prisma.roomType.findUnique({ where: { key } });
  if (existing) return NextResponse.json({ error: "该 key 已存在" }, { status: 409 });

  const count = await prisma.roomType.count();
  const type = await prisma.roomType.create({
    data: {
      key,
      displayName,
      icon: typeof body.icon === "string" ? body.icon : null,
      color: typeof body.color === "string" ? body.color : null,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : count,
      builtin: false,
    },
  });
  return NextResponse.json({ type }, { status: 201 });
}
