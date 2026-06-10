"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Platform } from "@/lib/types";
import { platformLabel } from "./icons";
import SourceItem from "./SourceItem";

export interface SourceRow {
  id: string;
  platform: string;
  feedUrl: string | null;
  query: string | null;
  label: string | null;
  enabled: boolean;
  lastError: string | null;
  lastFetchedAt: string | null;
}

const SOURCE_TYPES: Platform[] = [
  "youtube",
  "bilibili",
  "x",
  "rss",
  "arxiv",
  "github",
  "podcast",
  "manual",
];

function hintFor(p: string): string {
  switch (p) {
    case "youtube":
      return "UC… 频道ID / @handle / 频道链接（如 https://www.youtube.com/@handle）";
    case "bilibili":
      return "UP 主 mid 或主页链接（如 https://space.bilibili.com/123456）";
    case "x":
      return "@handle 或主页链接（如 https://x.com/handle）— 需先配置 x 登录态";
    case "rss":
      return "RSS / Atom feed URL";
    case "arxiv":
      return "查询串，如 cat:cs.AI 或 au:LeCun";
    case "github":
      return "owner/repo，如 huggingface/transformers";
    case "podcast":
      return "播客 RSS URL";
    default:
      return "manual：手动粘贴用，可留空";
  }
}

export default function RoomSources({
  roomId,
  sources,
}: {
  roomId: string;
  sources: SourceRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState<string>("youtube");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");

  const needsValue = platform !== "manual";

  async function addSource() {
    if (needsValue && !value.trim()) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { platform };
      if (label.trim()) body.label = label.trim();
      if (platform === "arxiv") body.query = value.trim();
      else if (value.trim()) body.feedUrl = value.trim();
      const res = await fetch(`/api/rooms/${roomId}/bindings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setValue("");
        setLabel("");
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "添加失败");
      }
    } catch {
      alert("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="src-panel">
      <div className="src-head">
        来源 Sources <span className="set-muted">（{sources.length}）</span>
      </div>

      {sources.length === 0 ? (
        <div className="set-muted" style={{ marginBottom: 12 }}>
          还没有来源。下面添加一个 YouTube 频道或 RSS，然后用该来源的"刷新最新 / 回溯历史"。
        </div>
      ) : (
        <div className="src-list">
          {sources.map((s) => (
            <SourceItem key={s.id} source={s} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}

      <div className="src-add">
        <select
          className="set-select"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          {SOURCE_TYPES.map((p) => (
            <option key={p} value={p}>
              {platformLabel(p)}
            </option>
          ))}
        </select>
        <input
          className="set-input"
          style={{ minWidth: 240 }}
          value={value}
          placeholder={hintFor(platform)}
          onChange={(e) => setValue(e.target.value)}
        />
        <input
          className="set-input"
          style={{ minWidth: 90 }}
          value={label}
          placeholder="标签(可选)"
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          type="button"
          className="set-btn"
          disabled={busy || (needsValue && !value.trim())}
          onClick={addSource}
        >
          ＋ 添加 Source
        </button>
      </div>
    </div>
  );
}
