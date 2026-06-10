import { NextResponse } from "next/server";
import { syncPlaylistTagsForBinding } from "@/lib/fetcher";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 读取所有播放列表可能较慢

// POST /api/sources/[id]/sync-playlist-tags —— 给本 source 已导入视频同步播放列表标签
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const res = await syncPlaylistTagsForBinding(params.id);
  return NextResponse.json(res, { status: res.error ? 500 : 200 });
}
