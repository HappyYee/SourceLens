"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// 刷新语义（与 /api/refresh 对齐）：
// - 检查更新：无时间窗，导入各源最新一批的全部新内容（默认动作，最常用）。
// - 今天/本周/范围：时间窗是【导入过滤器】，只导入窗内发布的条目。
// - 深度刷新：同检查更新，另对 arXiv 向更早翻页。
// - 某源的完整历史不在此菜单：用 Room 来源面板的「回溯历史」。
type Body = { scope?: "today" | "week" | "range" | "all"; since?: string; until?: string; force?: boolean };

export default function RefreshButton({
  roomId,
  label = "检查更新",
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
          <button type="button" className="rm-item rm-primary" onClick={() => run({ force: true })}>
            检查更新
            <span className="rm-sub">导入各源最新一批的全部新内容</span>
          </button>
          <button type="button" className="rm-item" onClick={() => run({ scope: "today" })}>
            刷新今天
            <span className="rm-sub">仅导入今天发布的内容</span>
          </button>
          <button type="button" className="rm-item" onClick={() => run({ scope: "week" })}>
            刷新本周
            <span className="rm-sub">仅导入近 7 天发布的内容</span>
          </button>
          <button type="button" className="rm-item" onClick={() => setShowRange((s) => !s)}>
            指定时间范围…
          </button>
          <button
            type="button"
            className="rm-item"
            onClick={() => {
              if (confirm("深度刷新：同检查更新，另对 arXiv 向更早翻页，可能较慢。继续？"))
                run({ scope: "all" });
            }}
          >
            深度刷新
            <span className="rm-sub">arXiv 向更早翻页；其余源同检查更新</span>
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

          <div className="rm-hint">某个源的完整历史 → 进入 Room，在来源面板用「回溯历史」</div>
        </div>
      )}
    </div>
  );
}
