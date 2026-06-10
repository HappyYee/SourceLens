"use client";

import { useState } from "react";

interface Report {
  input?: string;
  mid?: string | null;
  stage?: string;
  hasLoginProfile?: boolean;
  usedLoginFallback?: boolean;
  fallbackStage?: "none" | "node_request" | "parse_response";
  refetchedLoginWbi?: boolean;
  wbiOk?: boolean;
  firstApiCode?: number;
  firstApiMessage?: string;
  fallbackApiCode?: number;
  fallbackApiMessage?: string;
  fallbackBeforeCode?: number;
  fallbackBeforeMessage?: string;
  fallbackAfterCode?: number;
  fallbackAfterMessage?: string;
  fallbackNavCode?: number;
  fallbackNavIsLogin?: boolean;
  fallbackSignedWith?: "public" | "login";
  fallbackRequestMode?: "none" | "context.request" | "page.evaluate";
  fallbackContextRequestCode?: number;
  fallbackContextRequestMessage?: string;
  fallbackPageEvaluateCode?: number;
  fallbackPageEvaluateMessage?: string;
  fallbackError?: string;
  profileBusy?: boolean;
  videoCount?: number;
  firstVideo?: { bvid: string; title: string | null; publishedAt: string } | null;
  error?: string;
  networkLabel?: string;
}

function fallbackLabel(r: Report): string {
  if (!r.usedLoginFallback) return "没用";
  return r.error ? "已使用但仍失败" : "已使用";
}

export default function BiliDebug() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Report | null>(null);

  async function run() {
    if (!input.trim()) return;
    setBusy(true);
    setR(null);
    try {
      const res = await fetch("/api/debug/bilibili", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      setR((await res.json().catch(() => ({ error: "解析返回失败" }))) as Report);
    } catch {
      setR({ error: "网络错误" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="set-card">
      <h2>Bilibili 抓取自检</h2>
      <p className="set-muted" style={{ marginBottom: 8 }}>
        输入一个 UP 主 mid 或主页链接，逐阶段跑一遍公开抓取流程，看清失败点（不读取 / 不打印 cookie）。
      </p>
      <div className="set-form">
        <input
          className="set-input"
          style={{ minWidth: 280 }}
          placeholder="mid 或 https://space.bilibili.com/123456"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="button" className="set-btn" disabled={busy} onClick={run}>
          {busy ? "自检中…" : "运行自检"}
        </button>
      </div>
      {r ? (
        <div className="ap-detail" style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
          {r.error ? `✗ 失败：${r.error}\n` : "✓ 流程跑完\n"}
          {`阶段：${r.stage ?? "-"}\n`}
          {`mid：${r.mid ?? "-"}　通道：${r.networkLabel ?? "-"}\n`}
          {`WBI 签名：${r.wbiOk ? "OK" : "失败"}　有登录态：${r.hasLoginProfile ? "是" : "否"}\n`}
          {`登录态回退：${fallbackLabel(r)}　回退阶段：${r.fallbackStage ?? "none"}　重取登录态 WBI：${r.refetchedLoginWbi ? "是" : "否"}\n`}
          {`fallbackNavIsLogin：${r.fallbackNavIsLogin == null ? "-" : r.fallbackNavIsLogin ? "true" : "false"}　fallbackNavCode：${r.fallbackNavCode ?? "-"}\n`}
          {`fallbackSignedWith：${r.fallbackSignedWith ?? "-"}　fallbackRequestMode：${r.fallbackRequestMode ?? "-"}\n`}
          {`fallbackBeforeCode：${r.fallbackBeforeCode ?? r.firstApiCode ?? "-"}${(r.fallbackBeforeMessage ?? r.firstApiMessage) ? `（${r.fallbackBeforeMessage ?? r.firstApiMessage}）` : ""}\n`}
          {`fallbackAfterCode：${r.usedLoginFallback ? (r.fallbackAfterCode ?? r.fallbackApiCode ?? "-") : "-"}${(r.fallbackAfterMessage ?? r.fallbackApiMessage) ? `（${r.fallbackAfterMessage ?? r.fallbackApiMessage}）` : ""}\n`}
          {`context.request code：${r.fallbackContextRequestCode ?? "-"}${r.fallbackContextRequestMessage ? `（${r.fallbackContextRequestMessage}）` : ""}\n`}
          {`page.evaluate code：${r.fallbackPageEvaluateCode ?? "-"}${r.fallbackPageEvaluateMessage ? `（${r.fallbackPageEvaluateMessage}）` : ""}\n`}
          {r.profileBusy ? "⚠ profile 被占用：请先关闭登录窗口\n" : ""}
          {`抓到视频数：${r.videoCount ?? 0}\n`}
          {`首条：${
            r.firstVideo
              ? `${r.firstVideo.bvid} · ${r.firstVideo.title ?? "(无标题)"} · ${r.firstVideo.publishedAt}`
              : "-"
          }`}
        </div>
      ) : null}
    </div>
  );
}
