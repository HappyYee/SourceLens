"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ItemVM, RoomVM } from "@/lib/types";
import {
  filterGroupsByView,
  formatRelativeTime,
  groupByDay,
} from "@/lib/view";
import { PlatformIcon, platformLabel } from "./icons";
import ItemCard from "./ItemCard";
import RefreshButton from "./RefreshButton";
import ManualAdd from "./ManualAdd";
import RoomSources, { type SourceRow } from "./RoomSources";

export default function RoomView({
  room,
  nowISO,
  sources,
}: {
  room: RoomVM;
  nowISO: string;
  sources: SourceRow[];
}) {
  const now = new Date(nowISO);
  const router = useRouter();
  const [viewMode, setViewMode] = useState<0 | 1>(0);
  const [importance, setImportance] = useState(room.importance);
  const [items, setItems] = useState<ItemVM[]>(room.items);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const [, startTransition] = useTransition();

  // 切换到另一个 room（或服务端刷新）时同步初始数据
  useEffect(() => {
    setItems(room.items);
    setNoMore(false);
    setViewMode(0);
    setImportance(room.importance);
  }, [room.id, room.items, room.importance]);

  async function changeImportance(n: number) {
    setImportance(n); // 乐观更新
    try {
      await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importance: n }),
      });
      startTransition(() => router.refresh()); // 同步首页/侧栏的重要度排序
    } catch {
      // 网络失败：保留乐观值，下次刷新自动校正
    }
  }

  // 回溯：从当前最旧条目继续向过去翻页
  async function loadOlder() {
    if (loadingMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = items[items.length - 1].publishedAt;
      const res = await fetch(
        `/api/rooms/${room.id}/items?before=${encodeURIComponent(oldest)}&take=100`,
      );
      const j = await res.json();
      const more: ItemVM[] = j.items ?? [];
      if (more.length === 0) {
        setNoMore(true);
      } else {
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...more.filter((m) => !seen.has(m.id))];
        });
      }
    } catch {
      // 忽略网络错误
    } finally {
      setLoadingMore(false);
    }
  }

  async function editTitle(it: ItemVM) {
    const v = window.prompt("自定义标题（留空恢复自动标题）", it.customTitle ?? "");
    if (v === null) return; // 取消
    const trimmed = v.trim();
    setItems((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, customTitle: trimmed || null } : x)),
    ); // 乐观
    try {
      await fetch(`/api/items/${it.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customTitle: trimmed }),
      });
    } catch {
      // 忽略；下次刷新自动校正
    }
  }

  async function deleteRoom() {
    if (
      !confirm(
        `删除 room「${room.name}」？它的来源与内容会一并删除，子 room 会上移到上一层。`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      if (res.ok) router.push("/");
      else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "删除失败");
      }
    } catch {
      alert("网络错误");
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("删除这条内容？")) return;
    const prev = items;
    setItems((p) => p.filter((i) => i.id !== id)); // 乐观删除
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setItems(prev); // 回滚
        alert("删除失败：" + (j.error || `HTTP ${res.status}`));
      }
    } catch {
      setItems(prev);
      alert("删除失败：网络错误");
    }
  }

  const groups = filterGroupsByView(groupByDay(items, now), viewMode);

  return (
    <>
      <div className="topbar">
        <div className="crumb">
          <Link className="back" href="/">
            ← 首页
          </Link>
          ROOM / {room.name}
        </div>
        <div className="spacer" />
        <div className="seg">
          <button
            type="button"
            className={viewMode === 0 ? "on" : ""}
            onClick={() => setViewMode(0)}
          >
            今日轨迹
          </button>
          <button
            type="button"
            className={viewMode === 1 ? "on" : ""}
            onClick={() => setViewMode(1)}
          >
            回溯 ↺
          </button>
        </div>
        <RefreshButton roomId={room.id} label="刷新" />
      </div>

      <div className="content">
        <div className="room-hero">
          <div className="rh-left">
            <div className="rh-name">{room.name}</div>
            <div className="rh-sub">
              <span className="rh-type">{room.typeLabel ?? room.type ?? ""}</span>
              <span className="bindings">
                {room.bindings.map((b) => (
                  <span className="binding" key={b}>
                    <PlatformIcon platform={b} /> {platformLabel(b)}
                  </span>
                ))}
              </span>
            </div>
          </div>
          <div className="rh-right">
            <div className="imp-ctl">
              重要度
              <span className="squares">
                {[1, 2, 3, 4, 5].map((n) => (
                  <i
                    key={n}
                    className={n <= importance ? "on" : ""}
                    onClick={() => changeImportance(n)}
                  />
                ))}
              </span>
            </div>
            <div className="rh-hint">
              这个 room 把该对象在 {room.bindings.map(platformLabel).join(" / ")}{" "}
              上的发布，按时间穿成一条轨迹。子 room 各自独立收集，不汇入此处。
            </div>
          </div>
        </div>

        <RoomSources roomId={room.id} sources={sources} />

        <div className="room-toolbar">
          <ManualAdd roomId={room.id} />
          <button type="button" className="set-btn danger" onClick={deleteRoom}>
            删除 room
          </button>
        </div>

        <div className="timeline">
          {groups.length === 0 ? (
            <div className="empty">
              {viewMode === 1
                ? '更早的轨迹这里暂时为空。点下方"加载更早"继续向过去翻阅，或先点"刷新"抓取历史。'
                : "今日与昨日暂无更新。"}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.off}>
                <div className="day-div">
                  <span className="day-label">{g.label}</span>
                  <span className="ln" />
                </div>
                {g.items.map((it) => (
                  <ItemCard
                    key={it.id}
                    it={it}
                    timeLabel={formatRelativeTime(it.publishedAt, now)}
                    onDelete={() => deleteItem(it.id)}
                    onEditTitle={() => editTitle(it)}
                  />
                ))}
              </div>
            ))
          )}

          {viewMode === 1 && (
            <div className="loadmore">
              {noMore ? (
                <span className="set-muted">没有更早的内容了。</span>
              ) : (
                <button
                  type="button"
                  className="tool-btn"
                  onClick={loadOlder}
                  disabled={loadingMore}
                >
                  {loadingMore ? "加载中…" : "↓ 加载更早"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="foot">
          <b>启动器卡片</b>：只给标题 / 封面 / 时长 / 简介 + 原文链接，点出去看原文
          —— 源镜负责索引与编排，不替你读完内容。
        </div>
      </div>
    </>
  );
}
