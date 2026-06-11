import { NextResponse } from "next/server";
import { checkAvailabilityForBinding } from "@/lib/fetcher";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // videos.list 批查（50/批），大源也只是数次 API 调用

// POST /api/sources/[id]/check-availability —— 检查本 source 已入库条目源头是否仍可见
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const res = await checkAvailabilityForBinding(params.id);
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
