"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { NavTreeNode } from "@/lib/types";
import { IconChevron, IconHome } from "./icons";

function ImpDots({ n }: { n: number }) {
  return (
    <span className="imp">
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className={i < n ? "on" : ""} />
      ))}
    </span>
  );
}

// U3b 拖拽规则（原生 HTML5 DnD，零依赖）：
// - 拖到 Room 行上 → 放到它后面（移入其父级）；
// - 拖到分区行上 → 移入该分区末尾；
// - 拖到底部"顶层"条 → 移到顶层末尾。
// 同级中分区恒排在 Room 之前（树的既定排序语义），拖拽只调整各自组内顺序。
export default function Sidebar({
  tree,
  stats,
}: {
  tree: NavTreeNode[];
  stats: { sources: number; updated: number };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeId =
    pathname && pathname.startsWith("/room/")
      ? decodeURIComponent(pathname.split("/")[2] ?? "")
      : null;
  const homeActive = pathname === "/";

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function moveNode(parentId: string | null, afterId: string | null) {
    const id = draggingId;
    setDraggingId(null);
    setOverId(null);
    if (!id || id === afterId) return;
    try {
      const res = await fetch(`/api/rooms/${id}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parentId, afterId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "移动失败");
      }
      router.refresh();
    } catch {
      alert("移动失败：网络错误");
    }
  }

  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      setDraggingId(id);
    },
    onDragEnd: () => {
      setDraggingId(null);
      setOverId(null);
    },
  });

  const dropProps = (id: string, parentId: string | null, isFolder: boolean) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!draggingId || draggingId === id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOverId(id);
    },
    onDragLeave: () => setOverId((cur) => (cur === id ? null : cur)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (!draggingId || draggingId === id) return;
      if (isFolder) moveNode(id, null); // 移入分区末尾
      else moveNode(parentId, id); // 放到该 Room 后面
    },
  });

  function renderNode(node: NavTreeNode, depth: number) {
    const { row, children } = node;
    const pad = 8 + depth * 13;
    const isOver = overId === row.id && !!draggingId && draggingId !== row.id;

    if (row.nodeKind === "folder") {
      const open = !collapsed.has(row.id);
      return (
        <div key={row.id} className="nav-folder">
          <div
            className={`nav-folder-head ${activeId === row.id ? "active" : ""} ${isOver ? "drop-into" : ""} ${draggingId === row.id ? "dragging" : ""}`}
            style={{ paddingLeft: pad }}
            {...dragProps(row.id)}
            {...dropProps(row.id, row.parentId, true)}
            title="拖拽：移动此分区；拖到分区上=移入其中"
          >
            <button
              type="button"
              className="nav-caret"
              onClick={() => toggle(row.id)}
              aria-label="展开/折叠"
            >
              <IconChevron className={`chev ${open ? "" : "closed"}`} />
            </button>
            <Link href={`/room/${row.id}`} className="nav-folder-name">
              {row.name}
            </Link>
          </div>
          {open ? (
            <div className="nav-children">
              {children.map((c) => renderNode(c, depth + 1))}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <Link
        key={row.id}
        href={`/room/${row.id}`}
        className={`room-link ${activeId === row.id ? "active" : ""} ${isOver ? "drop-after" : ""} ${draggingId === row.id ? "dragging" : ""}`}
        style={{ paddingLeft: pad + 8 }}
        {...dragProps(row.id)}
        {...dropProps(row.id, row.parentId, false)}
        title="拖拽：移动此 Room；拖到 Room 上=放到它后面，拖到分区上=移入其中"
      >
        {row.name}
        <ImpDots n={row.importance} />
        {row.unreadCount > 0 ? <span className="upd">{row.unreadCount}</span> : null}
      </Link>
    );
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-row">
          <span className="brand-cn">源镜</span>
          <span className="brand-en">SourceLens</span>
        </div>
        <div className="brand-tag">Follow sources, not feeds.</div>
      </div>

      <div className="today-line">
        <span>
          <span className="dot" />
          {stats.sources} sources
        </span>
        <span>{stats.updated} 有未读</span>
      </div>

      <div className="nav">
        <Link href="/" className={`home-btn ${homeActive ? "active" : ""}`}>
          <IconHome />
          今日总览
        </Link>
        {tree.map((n) => renderNode(n, 0))}
      </div>

      {draggingId ? (
        <div
          className={`root-drop ${overId === "__root__" ? "drop-into" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOverId("__root__");
          }}
          onDragLeave={() => setOverId((cur) => (cur === "__root__" ? null : cur))}
          onDrop={(e) => {
            e.preventDefault();
            moveNode(null, null);
          }}
        >
          拖到此处 → 移到顶层
        </div>
      ) : (
        <Link className="new-btn" href="/settings?tab=structure&new=1">
          ＋ 新建分区 / Room
        </Link>
      )}
    </aside>
  );
}
