"use client";

import { useEffect, useState } from "react";
import type { UnreadFeedItem } from "@/lib/data";
import ItemCard from "./ItemCard";
import { formatRelativeTime } from "@/lib/view";

// 首页"新内容"：全局未读流。勾选/点击外链即标记已读并移出本列表（乐观更新）。
export default function UnreadFeed({
  initial,
  nowISO,
}: {
  initial: UnreadFeedItem[];
  nowISO: string;
}) {
  const now = new Date(nowISO);
  const [rows, setRows] = useState(initial);
  useEffect(() => setRows(initial), [initial]);

  function markRead(itemId: string) {
    setRows((prev) => prev.filter((r) => r.item.id !== itemId)); // 乐观移出
    fetch(`/api/items/${itemId}/read`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  }

  if (rows.length === 0) return null;

  return (
    <div className="unread-feed">
      <div className="uf-head">
        新内容 <span className="uf-count">{rows.length}{rows.length >= 50 ? "+" : ""} 条未读</span>
        <span className="uf-tip">勾选或打开原文即标记已读 · 各 Room 内可「全部标为已读」</span>
      </div>
      {rows.map(({ room, item }) => (
        <ItemCard
          key={item.id}
          it={item}
          timeLabel={formatRelativeTime(item.publishedAt, now)}
          room={room}
          onToggleRead={() => markRead(item.id)}
          onOpen={() => markRead(item.id)}
        />
      ))}
    </div>
  );
}
