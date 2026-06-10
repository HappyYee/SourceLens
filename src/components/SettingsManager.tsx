"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildTree } from "@/lib/tree";
import type { TreeNode, TreeRow } from "@/lib/tree";
import ParentPicker, { type PickerRow } from "./ParentPicker";

export interface SettingsRoom {
  id: string;
  name: string;
  nodeKind: string;
  type: string | null;
  importance: number;
  parentId: string | null;
  sortOrder: number;
  itemCount: number;
  childCount: number;
}

export interface SettingsType {
  key: string;
  displayName: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  builtin: boolean;
  usageCount: number;
}

export default function SettingsManager({
  initialRooms,
  initialTypes,
}: {
  initialRooms: SettingsRoom[];
  initialTypes: SettingsType[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // 新建节点
  const [nodeKind, setNodeKind] = useState<"folder" | "room">("room");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [roomType, setRoomType] = useState(initialTypes[0]?.key ?? "person");
  const [importance, setImportance] = useState(3);

  // 新增类型
  const [tKey, setTKey] = useState("");
  const [tName, setTName] = useState("");

  const pickerRows: PickerRow[] = initialRooms.map((r) => ({
    id: r.id,
    name: r.name,
    nodeKind: r.nodeKind,
    parentId: r.parentId,
    sortOrder: r.sortOrder,
  }));

  const ordered = useMemo(() => {
    const byId = new Map(initialRooms.map((r) => [r.id, r]));
    const out: { room: SettingsRoom; depth: number }[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        const r = byId.get(n.row.id);
        if (r) out.push({ room: r, depth });
        walk(n.children, depth + 1);
      }
    };
    walk(buildTree(pickerRows as TreeRow[]), 0);
    return out;
  }, [initialRooms]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function createType(e: React.FormEvent) {
    e.preventDefault();
    if (!tKey.trim() || !tName.trim()) return;
    const ok = await api("/api/types", "POST", {
      key: tKey.trim(),
      displayName: tName.trim(),
    });
    if (ok) {
      setTKey("");
      setTName("");
    }
  }

  return (
    <>
      {/* 新建节点 */}
      <div className="set-card">
        <h2>新建分区 / Room</h2>
        <form className="set-form" onSubmit={createNode}>
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

          <ParentPicker
            label="归属"
            value={parentId}
            onChange={setParentId}
            rows={pickerRows}
          />

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
      </div>

      {/* 所有节点 */}
      <div className="set-card">
        <h2>所有节点（{initialRooms.length}）</h2>
        {ordered.length === 0 ? (
          <p className="set-muted">还没有节点。用上面的表单新建，或运行 npm run seed:empty。</p>
        ) : (
          ordered.map(({ room, depth }) => (
            <div key={room.id} className="set-node" style={{ paddingLeft: depth * 20 }}>
              <span className="src-ic" aria-hidden>
                {room.nodeKind === "folder" ? "▣" : "▸"}
              </span>
              <span className="set-rname">{room.name}</span>
              <span className={`set-kind ${room.nodeKind === "folder" ? "folder" : ""}`}>
                {room.nodeKind === "folder" ? "分区" : "Room"}
              </span>

              {room.nodeKind === "room" ? (
                <>
                  <select
                    className="set-select"
                    style={{ minWidth: 110 }}
                    value={room.type ?? ""}
                    onChange={(e) =>
                      api(`/api/rooms/${room.id}`, "PATCH", { type: e.target.value })
                    }
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
                        onClick={() =>
                          api(`/api/rooms/${room.id}`, "PATCH", { importance: n })
                        }
                      />
                    ))}
                  </span>
                </>
              ) : null}

              <ParentPicker
                value={room.parentId}
                excludeId={room.id}
                rows={pickerRows}
                onChange={(pid) =>
                  api(`/api/rooms/${room.id}`, "PATCH", { parentId: pid })
                }
              />

              <button
                type="button"
                className="set-btn danger"
                onClick={() => {
                  if (
                    confirm(
                      `删除「${room.name}」？${room.nodeKind === "folder" ? "子项会上移到上一层。" : "其来源与内容会一并删除。"}`,
                    )
                  )
                    api(`/api/rooms/${room.id}`, "DELETE");
                }}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>

      {/* 类型管理 */}
      <div className="set-card">
        <h2>类型管理（roomType）</h2>
        <form className="set-form" onSubmit={createType} style={{ marginBottom: 12 }}>
          <div className="set-field">
            <label>key</label>
            <input
              className="set-input"
              style={{ minWidth: 140 }}
              value={tKey}
              onChange={(e) => setTKey(e.target.value)}
              placeholder="如 idol_member"
            />
          </div>
          <div className="set-field">
            <label>显示名</label>
            <input
              className="set-input"
              style={{ minWidth: 120 }}
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              placeholder="如 偶像成员"
            />
          </div>
          <button className="set-btn" type="submit" disabled={busy}>
            新增类型
          </button>
        </form>

        {initialTypes.map((t) => (
          <div key={t.key} className="type-row">
            <span className="type-key">{t.key}</span>
            <span className="type-name">{t.displayName}</span>
            {t.builtin ? <span className="set-kind">内置</span> : null}
            <span className="type-usage">使用中 {t.usageCount}</span>
            <button
              type="button"
              className="set-btn ghost"
              onClick={() => {
                const v = window.prompt("修改显示名", t.displayName);
                if (v && v.trim() && v.trim() !== t.displayName)
                  api(`/api/types/${t.key}`, "PATCH", { displayName: v.trim() });
              }}
            >
              改名
            </button>
            <button
              type="button"
              className="set-btn danger"
              onClick={() => {
                if (t.usageCount > 0) {
                  alert(`有 ${t.usageCount} 个 Room 正在使用该类型，请先迁移到其他类型。`);
                  return;
                }
                if (confirm(`删除类型「${t.displayName}」？`))
                  api(`/api/types/${t.key}`, "DELETE");
              }}
            >
              删除
            </button>
          </div>
        ))}
        <p className="set-muted" style={{ marginTop: 10 }}>
          folder 是结构类型，不在此列表。被使用中的类型不能直接删除。
        </p>
      </div>
    </>
  );
}
