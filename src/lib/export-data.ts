// 导出载荷组装（纯函数，可被 node --test 直跑）。
// 边界：AuthProfile 整表排除——profileDir 是本机路径、proxyUrl 可能内嵌凭证，均不属于档案。
// binding.authProfileId 作为无害 id 引用保留。

export interface ExportTables {
  rooms: unknown[];
  roomTypes: unknown[];
  bindings: unknown[];
  items: unknown[];
}

export interface ExportMeta {
  exportedAt: string; //  ISO 时间
  migration: string | null; // 最近一次已应用迁移名（schema 版本指纹）
}

export function buildExportPayload(tables: ExportTables, meta: ExportMeta) {
  return {
    meta: {
      app: "SourceLens",
      exportedAt: meta.exportedAt,
      migration: meta.migration,
      counts: {
        rooms: tables.rooms.length,
        roomTypes: tables.roomTypes.length,
        bindings: tables.bindings.length,
        items: tables.items.length,
      },
    },
    rooms: tables.rooms,
    roomTypes: tables.roomTypes,
    bindings: tables.bindings,
    items: tables.items,
  };
}
