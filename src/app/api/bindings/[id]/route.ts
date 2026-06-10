import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "body 无效" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.feedUrl === "string") data.feedUrl = body.feedUrl;
  if (typeof body.query === "string") data.query = body.query;
  if (typeof body.label === "string") data.label = body.label;
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.intervalMin === "number") data.intervalMin = body.intervalMin;

  try {
    const binding = await prisma.sourceBinding.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ binding });
  } catch {
    return NextResponse.json({ error: "绑定不存在" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.sourceBinding.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "绑定不存在" }, { status: 404 });
  }
}
