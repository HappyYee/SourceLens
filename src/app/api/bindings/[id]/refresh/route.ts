import { NextResponse } from "next/server";
import { refreshBinding } from "@/lib/fetcher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 抓取单条 binding
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const res = await refreshBinding(params.id);
  return NextResponse.json(res);
}
