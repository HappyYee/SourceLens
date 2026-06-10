import Link from "next/link";
import { getAllRoomsFlat, getAuthProfiles, getRoomTypes } from "@/lib/data";
import SettingsManager, {
  type SettingsRoom,
  type SettingsType,
} from "@/components/SettingsManager";
import AuthProfileManager, {
  type AuthProfileVM,
} from "@/components/AuthProfileManager";
import BiliDebug from "@/components/BiliDebug";
import DataTools from "@/components/DataTools";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let rooms: SettingsRoom[] = [];
  let types: SettingsType[] = [];
  let profiles: AuthProfileVM[] = [];
  try {
    const rows = await getAllRoomsFlat();
    rooms = rows.map((r) => ({
      id: r.id,
      name: r.name,
      nodeKind: r.nodeKind,
      type: r.type,
      importance: r.importance,
      parentId: r.parentId,
      sortOrder: r.sortOrder,
      itemCount: r._count.items,
      childCount: r._count.children,
    }));
    types = await getRoomTypes();
    profiles = (await getAuthProfiles()).map((p) => ({
      id: p.id,
      platform: p.platform,
      name: p.name,
      profileDir: p.profileDir,
      proxyMode: p.proxyMode,
      proxyUrl: p.proxyUrl,
      refreshRegion: p.refreshRegion,
      status: p.status,
      lastResult: p.lastResult,
      lastCheckedAt: p.lastCheckedAt ? p.lastCheckedAt.toISOString() : null,
    }));
  } catch {
    rooms = [];
    types = [];
    profiles = [];
  }

  return (
    <>
      <div className="topbar">
        <div className="crumb">
          <Link className="back" href="/">
            ← 首页
          </Link>
          设置 / 结构 · 类型 · 登录态
        </div>
      </div>
      <div className="content">
        <div className="set-wrap">
          <SettingsManager initialRooms={rooms} initialTypes={types} />
          <AuthProfileManager initialProfiles={profiles} />
          <BiliDebug />
          <DataTools />
        </div>
      </div>
    </>
  );
}
