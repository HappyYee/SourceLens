"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SettingsRoom {
  id: string;
  name: string;
  nodeKind: string;
  type: string | null;
  importance: number;
  parentId: string | null;
  sortOrder: number;
  itemCount: number;
  childCount: number;
}

export interface SettingsType {
  key: string;
  displayName: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  builtin: boolean;
  usageCount: number;
}

// 类型管理（U3 重构）：key 由显示名自动生成；未使用的内置类型默认收起。
export default function TypeManager({ initialTypes }: { initialTypes: SettingsType[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [tName, setTName] = useState("");
  const [showUnused, setShowUnused] = useState(false);

  const used = initialTypes.filter((t) => t.usageCount > 0 || !t.builtin);
  const unusedBuiltin = initialTypes.filter((t) => t.usageCount === 0 && t.builtin);

  async function api(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || `操作失败 (${res.status})`);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      alert("网络错误");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createType(e: React.FormEvent) {
    e.preventDefault();
    if (!tName.trim()) return;
    const ok = await api("/api/types", "POST", { displayName: tName.trim() });
    if (ok) setTName("");
  }

  function typeRow(t: SettingsType) {
    return (
      <div key={t.key} className="type-row">
        <span className="type-name">{t.displayName}</span>
        {t.builtin ? <span className="set-kind">内置</span> : null}
        <span className="type-key">{t.key}</span>
        <span className="type-usage">使用中 {t.usageCount}</span>
        <span className="spacer" />
        <button
          type="button"
          className="set-btn ghost"
          onClick={() => {
            const v = window.prompt("修改显示名", t.displayName);
            if (v && v.trim() && v.trim() !== t.displayName)
              api(`/api/types/${t.key}`, "PATCH", { displayName: v.trim() });
          }}
        >
          改名
        </button>
        <button
          type="button"
          className="set-btn danger"
          onClick={() => {
            if (t.usageCount > 0) {
              alert(`有 ${t.usageCount} 个 Room 正在使用该类型，请先迁移到其他类型。`);
              return;
            }
            if (confirm(`删除类型「${t.displayName}」？`)) api(`/api/types/${t.key}`, "DELETE");
          }}
        >
          删除
        </button>
      </div>
    );
  }

  return (
    <div className="set-card">
      <h2>类型管理（roomType）</h2>
      <form className="set-form" onSubmit={createType} style={{ marginBottom: 12 }}>
        <div className="set-field">
          <label>显示名</label>
          <input
            className="set-input"
            style={{ minWidth: 160 }}
            value={tName}
            onChange={(e) => setTName(e.target.value)}
            placeholder="如 偶像成员（key 将自动生成）"
          />
        </div>
        <button className="set-btn" type="submit" disabled={busy || !tName.trim()}>
          新增类型
        </button>
      </form>

      {used.map(typeRow)}

      {unusedBuiltin.length > 0 ? (
        <>
          <button
            type="button"
            className="set-btn ghost"
            style={{ marginTop: 10 }}
            onClick={() => setShowUnused((s) => !s)}
          >
            {showUnused ? "收起" : "显示"}未使用的内置类型（{unusedBuiltin.length}）{showUnused ? " ▲" : " ▾"}
          </button>
          {showUnused ? unusedBuiltin.map(typeRow) : null}
        </>
      ) : null}

      <p className="set-muted" style={{ marginTop: 10 }}>
        folder 是结构类型，不在此列表。被使用中的类型不能直接删除。
      </p>
    </div>
  );
}
