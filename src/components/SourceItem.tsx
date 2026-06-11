"use client";

import { useState } from "react";
import {
  formatBackfillResult,
  formatRefreshLatestResult,
  formatSyncTagsResult,
} from "@/lib/format-result";
import { sourceActionFlags } from "@/lib/source-actions";
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

  const isManual = source.platform === "manual";
  const flags = sourceActionFlags(source.platform);

  async function refreshLatest() {
    setBusy(true);
    setMsg("刷新最新中…");
    try {
      const res = await fetch(`/api/bindings/${source.id}/refresh`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      setMsg(formatRefreshLatestResult(res.ok && !j.error, j));
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
      setMsg(formatBackfillResult(res.ok && !j.error, j));
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
      setMsg(formatSyncTagsResult(res.ok && !j.error, j));
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
        {flags.canRefreshLatest ? (
          <button type="button" className="src-btn" disabled={busy} onClick={refreshLatest}>
            刷新最新
          </button>
        ) : null}
        {flags.canBackfill ? (
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
                {flags.allowBackfillAll ? (
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
        {flags.canSyncTags ? (
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
