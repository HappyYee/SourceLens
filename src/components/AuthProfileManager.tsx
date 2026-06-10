"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatOutcome, type RefreshOutcome } from "@/lib/network";

export interface AuthProfileVM {
  id: string;
  platform: string;
  name: string;
  profileDir: string;
  proxyMode: string;
  proxyUrl: string | null;
  refreshRegion: string;
  status: string;
  lastResult: string | null;
  lastCheckedAt: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  unknown: "未知",
  logged_in: "已登录",
  expired: "已失效",
  needs_check: "待检查",
};

export default function AuthProfileManager({
  initialProfiles,
}: {
  initialProfiles: AuthProfileVM[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});

  async function create(platform: "x" | "bilibili") {
    setBusy("new");
    try {
      const res = await fetch("/api/auth-profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform, name: "main" }),
      });
      if (res.ok) router.refresh();
      else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "创建失败");
      }
    } finally {
      setBusy(null);
    }
  }

  async function patch(id: string, data: Record<string, unknown>) {
    await fetch(`/api/auth-profiles/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    router.refresh();
  }

  async function open(id: string) {
    setBusy(id);
    setMsg((m) => ({ ...m, [id]: "正在打开登录窗口…" }));
    try {
      const res = await fetch(`/api/auth-profiles/${id}/open`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      setMsg((m) => ({
        ...m,
        [id]: j.ok ? j.message : `打开失败：${j.error || ""}${j.hint ? "。" + j.hint : ""}`,
      }));
    } catch {
      setMsg((m) => ({ ...m, [id]: "网络错误" }));
    } finally {
      setBusy(null);
    }
  }

  async function check(id: string) {
    setBusy(id);
    setMsg((m) => ({ ...m, [id]: "正在检查登录状态…" }));
    try {
      const res = await fetch(`/api/auth-profiles/${id}/check`, { method: "POST" });
      const o = (await res.json().catch(() => ({}))) as RefreshOutcome & {
        error?: string;
        debug?: {
          checkedUrl?: string;
          httpStatus?: number;
          navCode?: number;
          redirectedToLogin?: boolean;
          timedOut?: boolean;
        };
      };
      const baseText = o.networkLabel ? formatOutcome(o) : o.error || "检查失败";
      const d = o.debug;
      const extra = d
        ? `　[检查 ${d.checkedUrl ?? ""}${d.httpStatus != null ? ` · HTTP ${d.httpStatus}` : ""}` +
          `${d.navCode != null ? ` · nav ${d.navCode}` : ""}` +
          `${d.redirectedToLogin ? " · 跳转登录页" : ""}${d.timedOut ? " · 超时" : ""}]`
        : "";
      setMsg((m) => ({ ...m, [id]: baseText + extra }));
      router.refresh();
    } catch {
      setMsg((m) => ({ ...m, [id]: "网络错误" }));
    } finally {
      setBusy(null);
    }
  }

  async function diag(id: string) {
    setBusy(id);
    setMsg((m) => ({ ...m, [id]: "正在自检运行环境…" }));
    try {
      const res = await fetch(`/api/auth-profiles/${id}/diagnose`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      const detail = [
        j.summary,
        j.playwrightError ? `import 错误：${j.playwrightError}` : "",
        j.chromeError ? `Chrome：${j.chromeError}` : "",
        j.profileDirError ? `目录：${j.profileDirError}` : "",
      ]
        .filter(Boolean)
        .join("　");
      setMsg((m) => ({ ...m, [id]: detail || j.error || "诊断失败" }));
    } catch {
      setMsg((m) => ({ ...m, [id]: "网络错误" }));
    } finally {
      setBusy(null);
    }
  }

  async function del(id: string, name: string) {
    if (!confirm(`删除登录态「${name}」？会删掉它的专用 profile 目录（数据库与其它数据不受影响）。`))
      return;
    setBusy(id);
    try {
      const res = await fetch(`/api/auth-profiles/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else alert("删除失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="set-card">
      <h2>平台登录态</h2>
      <div className="set-form" style={{ marginBottom: 12 }}>
        <button type="button" className="set-btn" disabled={busy === "new"} onClick={() => create("x")}>
          ＋ 新建 X 登录态
        </button>
        <button type="button" className="set-btn" disabled={busy === "new"} onClick={() => create("bilibili")}>
          ＋ 新建 Bilibili 登录态
        </button>
      </div>

      {initialProfiles.length === 0 ? (
        <p className="set-muted">
          还没有登录态。新建后点"打开登录窗口"，在弹出的浏览器里手动登录（SourceLens 不碰你的密码 / cookie）。
        </p>
      ) : (
        initialProfiles.map((p) => (
          <div key={p.id} className="ap-row">
            <div className="ap-head">
              <span className="set-kind">{p.platform === "x" ? "X" : "Bilibili"}</span>
              <span className="set-rname">{p.name}</span>
              <span className={`ap-status ${p.status}`}>{STATUS_LABEL[p.status] ?? p.status}</span>
              <span className="type-usage">
                {p.lastCheckedAt ? `检查于 ${new Date(p.lastCheckedAt).toLocaleString()}` : "未检查"}
              </span>
            </div>
            <div className="ap-detail">Profile：{p.profileDir}</div>

            <div className="set-form" style={{ marginTop: 6 }}>
              <div className="set-field">
                <label>刷新通道</label>
                <select
                  className="set-select"
                  value={p.refreshRegion}
                  onChange={(e) => patch(p.id, { refreshRegion: e.target.value })}
                >
                  <option value="auto">自动</option>
                  <option value="domestic">国内刷新</option>
                  <option value="foreign">国外刷新</option>
                </select>
              </div>
              <div className="set-field">
                <label>代理模式</label>
                <select
                  className="set-select"
                  value={p.proxyMode}
                  onChange={(e) => patch(p.id, { proxyMode: e.target.value })}
                >
                  <option value="none">不使用代理</option>
                  <option value="system">系统 / 环境变量</option>
                  <option value="manual">手动代理</option>
                </select>
              </div>
              {p.proxyMode === "manual" ? (
                <div className="set-field">
                  <label>代理 URL</label>
                  <input
                    className="set-input"
                    defaultValue={p.proxyUrl ?? "http://127.0.0.1:33210"}
                    onBlur={(e) => patch(p.id, { proxyUrl: e.target.value })}
                    placeholder="http://127.0.0.1:33210"
                  />
                </div>
              ) : null}
            </div>

            <div className="set-form" style={{ marginTop: 6 }}>
              <button type="button" className="set-btn" disabled={busy === p.id} onClick={() => open(p.id)}>
                打开登录窗口
              </button>
              <button type="button" className="set-btn ghost" disabled={busy === p.id} onClick={() => check(p.id)}>
                检查登录状态
              </button>
              <button type="button" className="set-btn ghost" disabled={busy === p.id} onClick={() => diag(p.id)}>
                诊断环境
              </button>
              <button type="button" className="set-btn danger" disabled={busy === p.id} onClick={() => del(p.id, p.name)}>
                删除
              </button>
            </div>

            {msg[p.id] || p.lastResult ? (
              <div className="ap-msg">{msg[p.id] ?? `最近：${p.lastResult}`}</div>
            ) : null}
          </div>
        ))
      )}

      <p className="set-muted" style={{ marginTop: 10 }}>
        登录态只用于后续<strong>只读</strong>抓取（不点赞 / 关注 / 评论 / 转发 / 投币）。Profile 目录在
        data/browser-profiles/，已 gitignore、不上传。需本机装 Chrome 与 playwright-core；登录窗口只在你的 Mac 上能打开。
      </p>
    </div>
  );
}
