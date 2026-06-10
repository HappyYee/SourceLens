"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Body = { scope: "today" | "range" | "all"; since?: string; until?: string };

export default function RefreshButton({
  roomId,
  label = "刷新",
}: {
  roomId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showRange, setShowRange] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  async function run(body: Body) {
    setBusy(true);
    setMsg(null);
    setOpen(false);
    setShowRange(false);
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, ...body }),
      });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? `+${j.added ?? 0} 新 · ${j.updated ?? 0} 更` : j.error || "失败");
      if (res.ok) router.refresh();
    } catch {
      setMsg("网络错误");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 6000);
    }
  }

  function runRange() {
    if (!since && !until) return;
    run({
      scope: "range",
      since: since ? new Date(since).toISOString() : undefined,
      until: until ? new Date(`${until}T23:59:59`).toISOString() : undefined,
    });
  }

  return (
    <div className="refresh-wrap">
      <button
        type="button"
        className="tool-btn"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
      >
        {busy ? "↻ 刷新中…" : msg ? `↻ ${msg}` : `↻ ${label} ▾`}
      </button>

      {open && (
        <div className="refresh-menu">
          <button type="button" className="rm-item" onClick={() => run({ scope: "today" })}>
            刷新今天
          </button>
          <button type="button" className="rm-item" onClick={() => setShowRange((s) => !s)}>
            指定时间范围…
          </button>
          <button
            type="button"
            className="rm-item"
            onClick={() => {
              if (confirm("全时间范围刷新：尽可能向过去抓取更多历史，可能较慢。继续？"))
                run({ scope: "all" });
            }}
          >
            全部时间
          </button>

          {showRange && (
            <div className="rm-range">
              <label>
                从 <input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
              </label>
              <label>
                到 <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              </label>
              <button type="button" className="rm-go" onClick={runRange}>
                刷新此范围
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
