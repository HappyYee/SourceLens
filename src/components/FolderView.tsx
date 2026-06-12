"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FolderChild } from "@/lib/data";

export default function FolderView({
  folder,
  items,
}: {
  folder: { id: string; name: string };
  items: FolderChild[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function createChild(nodeKind: "folder" | "room") {
    const name = window.prompt(nodeKind === "folder" ? "子分区名称" : "Room 名称");
    if (!name || !name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), nodeKind, parentId: folder.id }),
      });
      if (res.ok) router.refresh();
      else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "创建失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm(`删除分区「${folder.name}」？子项会上移到上一层（不会丢失）。`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${folder.id}`, { method: "DELETE" });
      if (res.ok) router.push("/");
      else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "删除失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setBusy(false);
    }
  }

  const folders = items.filter((c) => c.nodeKind === "folder");
  const rooms = items.filter((c) => c.nodeKind === "room");

  function row(c: FolderChild) {
    return (
      <Link key={c.id} href={`/room/${c.id}`} className="folder-row">
        <span className="fr-icon">{c.nodeKind === "folder" ? "▣" : "▸"}</span>
        <span className="fr-name">{c.name}</span>
        {c.nodeKind === "room" && c.typeLabel ? (
          <span className="fr-type">{c.typeLabel}</span>
        ) : null}
        {c.nodeKind === "folder" ? (
          <span className="fr-meta">{c.childCount} 项</span>
        ) : c.unreadCount > 0 ? (
          <span className="upd">{c.unreadCount}</span>
        ) : null}
      </Link>
    );
  }

  return (
    <>
      <div className="topbar">
        <div className="crumb">
          <Link className="back" href="/">
            ← 首页
          </Link>
          分区 / {folder.name}
        </div>
      </div>
      <div className="content">
        <div className="room-hero">
          <div className="rh-left">
            <div className="rh-name">{folder.name}</div>
            <div className="rh-sub">
              <span className="rh-type">分区 FOLDER</span>
            </div>
          </div>
        </div>

        <div className="room-toolbar">
          <button type="button" className="tool-btn" disabled={busy} onClick={() => createChild("folder")}>
            ＋ 新建子分区
          </button>
          <button type="button" className="tool-btn" disabled={busy} onClick={() => createChild("room")}>
            ＋ 新建 Room
          </button>
          <button type="button" className="set-btn danger" disabled={busy} onClick={del}>
            删除分区
          </button>
        </div>

        {items.length === 0 ? (
          <div className="empty">这个分区还没有内容。你可以创建子分区或 Room。</div>
        ) : (
          <div className="folder-list">
            {folders.length ? (
              <div className="folder-group">
                <div className="folder-group-h">子分区</div>
                {folders.map(row)}
              </div>
            ) : null}
            {rooms.length ? (
              <div className="folder-group">
                <div className="folder-group-h">Room</div>
                {rooms.map(row)}
              </div>
            ) : null}
          </div>
        )}

        <div className="foot">
          <b>分区(folder)</b>：只组织结构，不收集 Source、不显示时间线。点子 Room 进入它的全平台时间线。
        </div>
      </div>
    </>
  );
}
