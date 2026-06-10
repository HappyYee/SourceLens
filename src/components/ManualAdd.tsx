"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ManualAdd({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/items/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomId,
          url: url.trim(),
          text: text.trim() || undefined,
        }),
      });
      if (res.ok) {
        setUrl("");
        setText("");
        setOpen(false);
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

  if (!open) {
    return (
      <button type="button" className="tool-btn" onClick={() => setOpen(true)}>
        ＋ 粘贴单条链接
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
    >
      <input
        className="set-input"
        style={{ minWidth: 240 }}
        placeholder="粘贴推文 / 任意链接 URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <input
        className="set-input"
        style={{ minWidth: 200 }}
        placeholder="文本（可选，用于自动拟题）"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="set-btn" type="submit" disabled={busy}>
        添加
      </button>
      <button
        className="set-btn ghost"
        type="button"
        onClick={() => setOpen(false)}
      >
        取消
      </button>
    </form>
  );
}
