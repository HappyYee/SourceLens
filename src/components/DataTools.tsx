"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DataTools() {
  const router = useRouter();
  const [opml, setOpml] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function importOpml() {
    if (!opml.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/import/opml", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opml }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`已导入 ${j.feeds} 个源、${j.folders} 个分区`);
        setOpml("");
        router.refresh();
      } else {
        setMsg(j.error || "导入失败");
      }
    } catch {
      setMsg("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setOpml(await file.text());
  }

  async function clearAll() {
    const word = window.prompt(
      '危险操作：将删除全部 rooms / 来源 / 内容且不可恢复。\n建议先运行 npm run backup。\n确认请输入：清空',
    );
    if (word !== "清空") return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/data", { method: "DELETE" });
      if (res.ok) {
        setMsg("已清空全部数据");
        router.refresh();
      } else {
        setMsg("清空失败");
      }
    } catch {
      setMsg("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="set-card">
      <h2>数据管理</h2>
      <div className="set-form" style={{ alignItems: "center" }}>
        <a className="set-btn ghost" href="/api/export">
          ⬇ 导出全部 (JSON)
        </a>
        {msg && <span className="set-muted">{msg}</span>}
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="set-field" style={{ width: "100%" }}>
          <label>导入 OPML（粘贴内容或选择文件）</label>
          <textarea
            className="set-input"
            style={{ minHeight: 90, width: "100%", fontFamily: "var(--mono)" }}
            value={opml}
            onChange={(e) => setOpml(e.target.value)}
            placeholder="<opml> … </opml>"
          />
        </div>
        <div className="set-form" style={{ marginTop: 8 }}>
          <input
            type="file"
            accept=".opml,.xml,text/xml"
            onChange={onFile}
            className="set-muted"
          />
          <button
            className="set-btn"
            type="button"
            onClick={importOpml}
            disabled={busy || !opml.trim()}
          >
            导入
          </button>
        </div>
      </div>

      <p className="set-muted" style={{ marginTop: 10 }}>
        OPML 里每个 feed 会变成一个 rss room，文件夹变成分区。导入后回首页点"检查更新"抓取内容。
      </p>

      <div className="set-danger-zone">
        <h3>危险区</h3>
        <div className="set-form" style={{ alignItems: "center" }}>
          <button className="set-btn danger" type="button" onClick={clearAll} disabled={busy}>
            清空全部数据
          </button>
          <span className="set-muted">删除全部 rooms / 来源 / 内容，不可恢复；需输入确认词。建议先 npm run backup。</span>
        </div>
      </div>
    </div>
  );
}
