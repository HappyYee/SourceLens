import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPlatform } from "@/lib/validate";

export const dynamic = "force-dynamic";

// 给 Room 加一条来源绑定
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => null);
  if (!body || !isPlatform(body.platform)) {
    return NextResponse.json(
      { error: "platform 必须是 rss|youtube|bilibili|arxiv|github|podcast|x|manual 之一" },
      { status: 400 },
    );
  }

  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room) return NextResponse.json({ error: "Room 不存在" }, { status: 404 });

  const binding = await prisma.sourceBinding.create({
    data: {
      roomId: params.id,
      platform: body.platform,
      feedUrl: typeof body.feedUrl === "string" ? body.feedUrl : null,
      query: typeof body.query === "string" ? body.query : null,
      label: typeof body.label === "string" ? body.label : null,
      intervalMin:
        typeof body.intervalMin === "number" ? body.intervalMin : 60,
    },
  });
  return NextResponse.json({ binding }, { status: 201 });
}
