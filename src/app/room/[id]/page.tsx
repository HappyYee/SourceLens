import { notFound } from "next/navigation";
import RoomView from "@/components/RoomView";
import FolderView from "@/components/FolderView";
import type { SourceRow } from "@/components/RoomSources";
import { getFolderChildren, getRoomById, getRoomSources } from "@/lib/data";
import type { FolderChild } from "@/lib/data";
import type { RoomVM } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: { id: string };
}) {
  const now = new Date();
  let room: RoomVM | null = null;
  try {
    room = await getRoomById(params.id);
  } catch {
    room = null;
  }
  if (!room) notFound();

  // folder 显示分区页（子项管理，无 Source / 时间线）
  if (room.nodeKind === "folder") {
    let children: FolderChild[] = [];
    try {
      children = await getFolderChildren(params.id);
    } catch {
      children = [];
    }
    return <FolderView folder={{ id: room.id, name: room.name }} items={children} />;
  }

  // room 显示内容页（Source 面板 + 时间线）
  let sources: SourceRow[] = [];
  try {
    sources = (await getRoomSources(params.id)).map((s) => ({
      ...s,
      lastFetchedAt: s.lastFetchedAt ? s.lastFetchedAt.toISOString() : null,
    }));
  } catch {
    sources = [];
  }
  return <RoomView room={room} nowISO={now.toISOString()} sources={sources} />;
}
