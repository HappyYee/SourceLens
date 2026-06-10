// 服务端读查询：把 Prisma 结果映射成视图模型。仅在 server 组件 / route handler 中调用。

import { prisma } from "./db";
import type { NavData, RoomTypeVM, RoomVM } from "./types";
import type { NavRow } from "./types";
import { toRoomVM } from "./map";
import { sortedRooms } from "./view";
import { buildTree } from "./tree";

const RECENT_TAKE = 80;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** roomType key → displayName 映射。 */
async function getTypeLabelMap(): Promise<Record<string, string>> {
  const types = await prisma.roomType.findMany({ select: { key: true, displayName: true } });
  const m: Record<string, string> = {};
  for (const t of types) m[t.key] = t.displayName;
  return m;
}

function withTypeLabel(vm: RoomVM, labels: Record<string, string>): RoomVM {
  return { ...vm, typeLabel: vm.type ? (labels[vm.type] ?? vm.type) : null };
}

/** 首页：所有 room(nodeKind='room')，含最近条目，按重要度排序。folder 不入首页。 */
export async function getHomeRooms(): Promise<RoomVM[]> {
  const [rooms, labels] = await Promise.all([
    prisma.room.findMany({
      where: { nodeKind: "room" },
      include: {
        bindings: { select: { platform: true } },
        items: { orderBy: { publishedAt: "desc" }, take: RECENT_TAKE },
      },
    }),
    getTypeLabelMap(),
  ]);
  return sortedRooms(rooms.map((r) => withTypeLabel(toRoomVM(r), labels)));
}

/** 单个节点（room/folder 都可），含 room 的时间线。支持 before 回溯翻页。 */
export async function getRoomById(
  id: string,
  opts?: { take?: number; before?: Date },
): Promise<RoomVM | null> {
  const [room, labels] = await Promise.all([
    prisma.room.findUnique({
      where: { id },
      include: {
        bindings: { select: { platform: true } },
        items: {
          where: opts?.before ? { publishedAt: { lt: opts.before } } : undefined,
          orderBy: { publishedAt: "desc" },
          take: opts?.take ?? 300,
        },
      },
    }),
    getTypeLabelMap(),
  ]);
  return room ? withTypeLabel(toRoomVM(room), labels) : null;
}

/** 侧栏：导航树（任意深度）+ 顶部统计。 */
export async function getNavTree(): Promise<NavData> {
  const start = startOfToday();
  const [rows, labels] = await Promise.all([
    prisma.room.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { bindings: true } },
        items: { where: { publishedAt: { gte: start } }, select: { id: true } },
      },
    }),
    getTypeLabelMap(),
  ]);

  let sources = 0;
  let updated = 0;
  const navRows: NavRow[] = rows.map((r) => {
    const today = r.items.length;
    sources += r._count.bindings;
    if (r.nodeKind === "room" && today > 0) updated += 1;
    return {
      id: r.id,
      name: r.name,
      nodeKind: r.nodeKind,
      parentId: r.parentId,
      sortOrder: r.sortOrder,
      importance: r.importance,
      updCount: today,
      roomType: r.type,
      typeLabel: r.type ? (labels[r.type] ?? r.type) : null,
    };
  });

  return { tree: buildTree(navRows), stats: { sources, updated } };
}

/** 内容类型列表（带使用中的 room 数）。folder 不在其中。 */
export async function getRoomTypes(): Promise<RoomTypeVM[]> {
  const [types, grouped] = await Promise.all([
    prisma.roomType.findMany({ orderBy: [{ sortOrder: "asc" }, { key: "asc" }] }),
    prisma.room.groupBy({
      by: ["type"],
      where: { nodeKind: "room", type: { not: null } },
      _count: true,
    }),
  ]);
  const usage: Record<string, number> = {};
  for (const g of grouped) if (g.type) usage[g.type] = g._count;
  return types.map((t) => ({
    key: t.key,
    displayName: t.displayName,
    icon: t.icon,
    color: t.color,
    sortOrder: t.sortOrder,
    builtin: t.builtin,
    usageCount: usage[t.key] ?? 0,
  }));
}

export interface FolderChild {
  id: string;
  name: string;
  nodeKind: string;
  typeLabel: string | null;
  importance: number;
  updCount: number;
  childCount: number;
}

/** folder 页：直接子节点（子 folder + 子 room），folder 在前。 */
export async function getFolderChildren(folderId: string): Promise<FolderChild[]> {
  const start = startOfToday();
  const [rows, labels] = await Promise.all([
    prisma.room.findMany({
      where: { parentId: folderId },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { children: true } },
        items: { where: { publishedAt: { gte: start } }, select: { id: true } },
      },
    }),
    getTypeLabelMap(),
  ]);
  const mapped: FolderChild[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    nodeKind: r.nodeKind,
    typeLabel: r.type ? (labels[r.type] ?? r.type) : null,
    importance: r.importance,
    updCount: r.items.length,
    childCount: r._count.children,
  }));
  return mapped.sort((a, b) => {
    const af = a.nodeKind === "folder";
    const bf = b.nodeKind === "folder";
    return af === bf ? 0 : af ? -1 : 1;
  });
}

/** 某 Room 的全部来源绑定（完整字段，用于 Room 页 Source 面板）。 */
export async function getRoomSources(roomId: string) {
  return prisma.sourceBinding.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      platform: true,
      feedUrl: true,
      query: true,
      label: true,
      enabled: true,
      lastError: true,
      lastFetchedAt: true,
    },
  });
}

/** 所有平台登录态（AuthProfile）。 */
export async function getAuthProfiles() {
  return prisma.authProfile.findMany({
    orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
  });
}

/** 所有 Room（含 folder）扁平列表，用于设置页 / 父级选择器。 */
export async function getAllRoomsFlat() {
  return prisma.room.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      bindings: true,
      _count: { select: { items: true, children: true } },
    },
  });
}
