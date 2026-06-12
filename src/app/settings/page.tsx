import Link from "next/link";
import { getAllRoomsFlat, getAuthProfiles, getRoomTypes } from "@/lib/data";
import NodeManager from "@/components/NodeManager";
import TypeManager, {
  type SettingsRoom,
  type SettingsType,
} from "@/components/TypeManager";
import AuthProfileManager, {
  type AuthProfileVM,
} from "@/components/AuthProfileManager";
import BiliDebug from "@/components/BiliDebug";
import DataTools from "@/components/DataTools";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "structure", label: "结构" },
  { key: "types", label: "类型" },
  { key: "auth", label: "登录态" },
  { key: "data", label: "数据" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { tab?: string; new?: string };
}) {
  const tab: TabKey = (TABS.find((t) => t.key === searchParams?.tab)?.key ?? "structure") as TabKey;
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
          设置
        </div>
        <div className="spacer" />
        <div className="seg">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/settings?tab=${t.key}`}
              className={tab === t.key ? "on" : ""}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="content">
        <div className="set-wrap">
          {tab === "structure" ? (
            <NodeManager
              initialRooms={rooms}
              initialTypes={types}
              initialCreateOpen={searchParams?.new === "1"}
            />
          ) : null}
          {tab === "types" ? <TypeManager initialTypes={types} /> : null}
          {tab === "auth" ? (
            <>
              <AuthProfileManager initialProfiles={profiles} />
              <BiliDebug />
            </>
          ) : null}
          {tab === "data" ? <DataTools /> : null}
        </div>
      </div>
    </>
  );
}
