"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildTree } from "@/lib/tree";
import type { TreeNode, TreeRow } from "@/lib/tree";
import ParentPicker, { type PickerRow } from "./ParentPicker";
import type { SettingsRoom, SettingsType } from "./TypeManager";

// 结构管理（U3 重构）：行内只读、点击才编辑、folder 可折叠、新建表单默认收起。
export default function NodeManager({
  initialRooms,
  initialTypes,
  initialCreateOpen = false,
}: {
  initialRooms: SettingsRoom[];
  initialTypes: SettingsType[];
  initialCreateOpen?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(initialCreateOpen);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // 新建节点
  const [nodeKind, setNodeKind] = useState<"folder" | "room">("room");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [roomType, setRoomType] = useState(
    initialTypes.find((t) => t.key === "person")?.key ?? initialTypes[0]?.key ?? "person",
  );
  const [importance, setImportance] = useState(3);

  const typeLabel = useMemo(
    () => Object.fromEntries(initialTypes.map((t) => [t.key, t.displayName])),
    [initialTypes],
  );
  const pickerRows: PickerRow[] = initialRooms.map((r) => ({
    id: r.id,
    name: r.name,
    nodeKind: r.nodeKind,
    parentId: r.parentId,
    sortOrder: r.sortOrder,
  }));

  const ordered = useMemo(() => {
    const byId = new Map(initialRooms.map((r) => [r.id, r]));
    const out: { room: SettingsRoom; depth: number; hidden: boolean }[] = [];
    const walk = (nodes: TreeNode[], depth: number, hiddenByAncestor: boolean) => {
      for (const n of nodes) {
        const r = byId.get(n.row.id);
        if (!r) continue;
        out.push({ room: r, depth, hidden: hiddenByAncestor });
        walk(n.children, depth + 1, hiddenByAncestor || collapsed.has(r.id));
      }
    };
    walk(buildTree(pickerRows as TreeRow[]), 0, false);
    return out;
  }, [initialRooms, collapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  async function api(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || `操作失败 (${res.status})`);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      alert("网络错误");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createNode(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const body: Record<string, unknown> = {
      name: name.trim(),
      nodeKind,
      parentId,
      importance,
    };
    if (nodeKind === "room") body.type = roomType;
    const ok = await api("/api/rooms", "POST", body);
    if (ok) {
      setName("");
      setParentId(null);
    }
  }

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {/* 新建（默认收起） */}
      <div className="set-card">
        <div className="set-card-head">
          <h2>结构</h2>
          <button
            type="button"
            className="set-btn"
            onClick={() => setCreateOpen((o) => !o)}
          >
            {createOpen ? "收起新建 ▲" : "＋ 新建分区 / Room"}
          </button>
        </div>
        {createOpen ? (
          <>
            <form className="set-form" onSubmit={createNode} style={{ marginTop: 10 }}>
              <div className="set-field">
                <label>节点类型</label>
                <span className="kind-toggle">
                  <button
                    type="button"
                    className={nodeKind === "folder" ? "on" : ""}
                    onClick={() => setNodeKind("folder")}
                  >
                    分区 Folder
                  </button>
                  <button
                    type="button"
                    className={nodeKind === "room" ? "on" : ""}
                    onClick={() => setNodeKind("room")}
                  >
                    Room 内容房间
                  </button>
                </span>
              </div>
              <div className="set-field">
                <label>名称</label>
                <input
                  className="set-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={nodeKind === "folder" ? "如 乃木坂46 / 5期生" : "如 井上和"}
                />
              </div>
              <ParentPicker label="归属" value={parentId} onChange={setParentId} rows={pickerRows} />
              {nodeKind === "room" ? (
                <div className="set-field">
                  <label>内容类型</label>
                  <select
                    className="set-select"
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                  >
                    {initialTypes.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="set-field">
                <label>重要度</label>
                <span className="set-squares">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i
                      key={n}
                      className={n <= importance ? "on" : ""}
                      onClick={() => setImportance(n)}
                    />
                  ))}
                </span>
              </div>
              <button className="set-btn" type="submit" disabled={busy}>
                新建
              </button>
            </form>
            <p className="set-muted" style={{ marginTop: 10 }}>
              分区(folder)只组织结构、不收集 Source；Room 才能添加来源、显示时间线。父级只能选分区。
            </p>
          </>
        ) : null}
      </div>

      {/* 所有节点：树形 + 只读行 + 行内编辑 */}
      <div className="set-card">
        <h2>所有节点（{initialRooms.length}）</h2>
        <p className="set-muted" style={{ margin: "4px 0 10px" }}>
          日常挪动建议直接在左侧导航拖拽；这里适合批量整理与精确编辑。同级中分区恒排在 Room 之前。
        </p>
        {ordered.length === 0 ? (
          <p className="set-muted">还没有节点。点上方「新建分区 / Room」。</p>
        ) : (
          ordered.map(({ room, depth, hidden }) => {
            if (hidden) return null;
            const editing = editingId === room.id;
            const isFolder = room.nodeKind === "folder";
            return (
              <div key={room.id}>
                <div className="set-node lite" style={{ paddingLeft: depth * 20 }}>
                  {isFolder ? (
                    <button
                      type="button"
                      className="nav-caret"
                      onClick={() => toggleCollapse(room.id)}
                      title="折叠/展开子树"
                    >
                      {collapsed.has(room.id) ? "▸" : "▾"}
                    </button>
                  ) : (
                    <span className="nav-caret-ph" />
                  )}
                  <span className="set-rname">{room.name}</span>
                  <span className={`set-kind ${isFolder ? "folder" : ""}`}>
                    {isFolder ? "分区" : "Room"}
                  </span>
                  {!isFolder ? (
                    <>
                      <span className="set-typechip">{typeLabel[room.type ?? ""] ?? room.type ?? "—"}</span>
                      <span className="set-impdots" title={`重要度 ${room.importance}`}>
                        {"●".repeat(room.importance)}
                        {"○".repeat(5 - room.importance)}
                      </span>
                      <span className="set-count">{room.itemCount} 条</span>
                    </>
                  ) : (
                    <span className="set-count">{room.childCount} 子项</span>
                  )}
                  <span className="spacer" />
                  <button
                    type="button"
                    className="set-btn ghost"
                    onClick={() => setEditingId(editing ? null : room.id)}
                  >
                    {editing ? "完成" : "编辑"}
                  </button>
                </div>

                {editing ? (
                  <div className="set-node-edit" style={{ marginLeft: depth * 20 }}>
                    {!isFolder ? (
                      <>
                        <select
                          className="set-select"
                          style={{ minWidth: 110 }}
                          value={room.type ?? ""}
                          onChange={(e) => api(`/api/rooms/${room.id}`, "PATCH", { type: e.target.value })}
                          title="内容类型"
                        >
                          {initialTypes.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.displayName}
                            </option>
                          ))}
                        </select>
                        <span className="set-squares" title="重要度">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <i
                              key={n}
                              className={n <= room.importance ? "on" : ""}
                              onClick={() => api(`/api/rooms/${room.id}`, "PATCH", { importance: n })}
                            />
                          ))}
                        </span>
                      </>
                    ) : null}
                    <ParentPicker
                      value={room.parentId}
                      excludeId={room.id}
                      rows={pickerRows}
                      onChange={(pid) => api(`/api/rooms/${room.id}`, "PATCH", { parentId: pid })}
                    />
                    <button
                      type="button"
                      className="set-btn danger"
                      onClick={() => {
                        if (
                          confirm(
                            `删除「${room.name}」？${isFolder ? "子项会上移到上一层。" : "其来源与内容会一并删除。"}`,
                          )
                        )
                          api(`/api/rooms/${room.id}`, "DELETE");
                      }}
                    >
                      删除
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
