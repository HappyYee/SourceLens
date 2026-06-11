import { NextResponse } from "next/server";
import { backfillBinding } from "@/lib/fetcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 回溯可能较慢（多页 API）

// POST /api/sources/[id]/backfill  body: { limit: 50 | 100 | 300 | "all" }
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const raw = body.limit;
  const limit: number | "all" =
    raw === "all" || raw === 50 || raw === 100 || raw === 300 ? raw : 100;

  const res = await backfillBinding(params.id, limit);
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
