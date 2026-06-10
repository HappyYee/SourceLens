"use client";

import { useEffect, useMemo, useState } from "react";
import { flattenFolders, nodePath } from "@/lib/tree";
import type { TreeRow } from "@/lib/tree";

export interface PickerRow {
  id: string;
  name: string;
  nodeKind: string;
  parentId: string | null;
  sortOrder: number;
}

/**
 * 可搜索的父级选择器：只列 folder（默认），显示完整路径，排除自身+子孙（防成环）。
 * rows 不传则自行从 /api/rooms 拉取。
 */
export default function ParentPicker({
  value,
  onChange,
  excludeId,
  label,
  rows: rowsProp,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  excludeId?: string;
  label?: string;
  rows?: PickerRow[];
}) {
  const [fetched, setFetched] = useState<PickerRow[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (rowsProp) return;
    let alive = true;
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((j) => {
        if (alive) {
          setFetched(
            (j.rooms ?? []).map((r: PickerRow) => ({
              id: r.id,
              name: r.name,
              nodeKind: r.nodeKind,
              parentId: r.parentId,
              sortOrder: r.sortOrder,
            })),
          );
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [rowsProp]);

  const rows = (rowsProp ?? fetched) as TreeRow[];
  const folders = useMemo(() => flattenFolders(rows, excludeId), [rows, excludeId]);
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return kw
      ? folders.filter((f) => f.path.join(" / ").toLowerCase().includes(kw))
      : folders;
  }, [folders, q]);
  const selectedPath = value
    ? nodePath(rows, value).join(" / ") || "（已删除）"
    : "（顶层）";

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
    setQ("");
  }

  return (
    <div className="pp">
      {label ? <label className="pp-label">{label}</label> : null}
      <button type="button" className="pp-btn" onClick={() => setOpen((o) => !o)}>
        {selectedPath} ▾
      </button>
      {open ? (
        <div className="pp-panel">
          <input
            className="set-input"
            autoFocus
            placeholder="搜索分区…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%" }}
          />
          <div className="pp-list">
            <button
              type="button"
              className={`pp-item ${value == null ? "on" : ""}`}
              onClick={() => pick(null)}
            >
              （顶层）
            </button>
            {filtered.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`pp-item ${value === f.id ? "on" : ""}`}
                style={{ paddingLeft: 10 + f.depth * 14 }}
                onClick={() => pick(f.id)}
                title={f.path.join(" / ")}
              >
                {q.trim() ? f.path.join(" / ") : f.name}
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="pp-empty">没有匹配的分区</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
