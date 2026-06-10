"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export default function Sidebar({
  tree,
  stats,
}: {
  tree: NavTreeNode[];
  stats: { sources: number; updated: number };
}) {
  const pathname = usePathname();
  const activeId =
    pathname && pathname.startsWith("/room/")
      ? decodeURIComponent(pathname.split("/")[2] ?? "")
      : null;
  const homeActive = pathname === "/";

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function renderNode(node: NavTreeNode, depth: number) {
    const { row, children } = node;
    const pad = 8 + depth * 13;

    if (row.nodeKind === "folder") {
      const open = !collapsed.has(row.id);
      return (
        <div key={row.id} className="nav-folder">
          <div
            className={`nav-folder-head ${activeId === row.id ? "active" : ""}`}
            style={{ paddingLeft: pad }}
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
        className={`room-link ${activeId === row.id ? "active" : ""}`}
        style={{ paddingLeft: pad + 8 }}
      >
        {row.name}
        <ImpDots n={row.importance} />
        {row.updCount > 0 ? <span className="upd">{row.updCount}</span> : null}
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
        <span>{stats.updated} 有更新</span>
      </div>

      <div className="nav">
        <Link href="/" className={`home-btn ${homeActive ? "active" : ""}`}>
          <IconHome />
          今日总览
        </Link>
        {tree.map((n) => renderNode(n, 0))}
      </div>

      <Link className="new-btn" href="/settings">
        ＋ 新建分区 / Room
      </Link>
    </aside>
  );
}
