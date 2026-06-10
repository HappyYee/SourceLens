"use client";

import { useState } from "react";
import type { Platform } from "@/lib/types";
import { PlatformIcon, platformLabel } from "./icons";
import type { SourceRow } from "./RoomSources";

const LIMITS = [50, 100, 300] as const;

export default function SourceItem({
  source,
  onChanged,
}: {
  source: SourceRow;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showLimits, setShowLimits] = useState(false);

  const isYouTube = source.platform === "youtube";
  const isManual = source.platform === "manual";
  const canBackfill =
    source.platform === "youtube" || source.platform === "bilibili" || source.platform === "x";
  const allowAll = source.platform === "youtube" || source.platform === "bilibili";

  async function refreshLatest() {
    setBusy(true);
    setMsg("刷新最新中…");
    try {
      const res = await fetch(`/api/bindings/${source.id}/refresh`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      const tag = j.networkLabel ? `${j.networkLabel} · ` : "";
      setMsg(
        res.ok && !j.error
          ? `${tag}最新：+${j.added ?? 0} 新 · ${j.updated ?? 0} 更`
          : `${tag}${j.error || "刷新失败"}${j.hint ? "。" + j.hint : ""}`,
      );
      onChanged();
    } catch {
      setMsg("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function backfill(limit: number | "all") {
    setShowLimits(false);
    setBusy(true);
    setMsg(`回溯历史（${limit}）中…`);
    try {
      const res = await fetch(`/api/sources/${source.id}/backfill`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const j = await res.json().catch(() => ({}));
      const tag = j.networkLabel ? `${j.networkLabel} · ` : "";
      if (res.ok && !j.error) {
        setMsg(
          `${tag}回溯：+${j.createdCount} 新 · ${j.updatedCount} 更 · 已扫描 ${j.fetchedCount}` +
            (j.shortsCount ? ` · Shorts ${j.shortsCount}` : "") +
            (j.skippedCount ? ` · 跳过 ${j.skippedCount}` : "") +
            (j.playlistTaggedCount ? ` · 打标 ${j.playlistTaggedCount}` : "") +
            (j.hasMore ? " · 还有更多" : ""),
        );
      } else {
        setMsg(`${tag}${j.error || "回溯失败"}${j.hint ? "。" + j.hint : ""}`);
      }
      onChanged();
    } catch {
      setMsg("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function syncTags() {
    setBusy(true);
    setMsg("同步播放列表标签中…");
    try {
      const res = await fetch(`/api/sources/${source.id}/sync-playlist-tags`, {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      const tag = j.networkLabel ? `${j.networkLabel} · ` : "";
      setMsg(
        res.ok && !j.error
          ? `${tag}播放列表：${j.playlistCount} 个 · 打标 ${j.taggedCount} 条`
          : `${tag}${j.error || "同步失败"}${j.hint ? "。" + j.hint : ""}`,
      );
      onChanged();
    } catch {
      setMsg("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `删除来源「${source.label || source.platform}」？历史卡片会保留为档案，只删这个来源。`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bindings/${source.id}`, { method: "DELETE" });
      if (res.ok) onChanged();
      else setMsg("删除失败");
    } catch {
      setMsg("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="src-item">
      <span className="src-ic">
        <PlatformIcon platform={source.platform as Platform} />
      </span>
      <span className="src-name">
        {source.label || platformLabel(source.platform as Platform)}
      </span>
      <span className="src-detail">
        {source.feedUrl || source.query || (isManual ? "手动粘贴" : "—")}
      </span>
      {source.lastError ? (
        <span className="src-err" title={source.lastError}>
          ⚠ {source.lastError}
        </span>
      ) : null}

      <span className="src-actions">
        {!isManual ? (
          <button type="button" className="src-btn" disabled={busy} onClick={refreshLatest}>
            刷新最新
          </button>
        ) : null}
        {canBackfill ? (
          <span className="src-bf">
            <button
              type="button"
              className="src-btn"
              disabled={busy}
              onClick={() => setShowLimits((s) => !s)}
            >
              回溯历史 ▾
            </button>
            {showLimits ? (
              <span className="src-limits">
                {LIMITS.map((n) => (
                  <button key={n} type="button" onClick={() => backfill(n)}>
                    {n}
                  </button>
                ))}
                {allowAll ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("回溯全部历史可能较慢、消耗较多配额。继续？")) backfill("all");
                    }}
                  >
                    全部
                  </button>
                ) : null}
              </span>
            ) : null}
          </span>
        ) : null}
        {isYouTube ? (
          <button type="button" className="src-btn" disabled={busy} onClick={syncTags}>
            同步播放列表标签
          </button>
        ) : null}
        <button type="button" className="src-x" title="删除来源" disabled={busy} onClick={remove}>
          ✕
        </button>
      </span>

      {msg ? <span className="src-msg">{msg}</span> : null}
    </div>
  );
}
