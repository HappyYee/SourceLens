import { NextResponse } from "next/server";
import { getHomeRooms } from "@/lib/data";

export const dynamic = "force-dynamic";

// 首页数据：Room 列表（按重要度排序）+ 各自最近条目。
export async function GET() {
  const rooms = await getHomeRooms();
  return NextResponse.json({ rooms });
}
