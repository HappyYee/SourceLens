"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// 启动自动刷新：进入首页后台触发一次"检查更新"（force=false：尊重每源 intervalMin 节流，
// 不会每次导航都打平台）。localStorage 再加一层 15 分钟会话节流，避免反复回首页时空转。
const THROTTLE_MS = 15 * 60 * 1000;
const LS_KEY = "sl:lastAutoRefreshAt";

export default function AutoRefresh() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    try {
      const last = Number(localStorage.getItem(LS_KEY) || 0);
      if (Date.now() - last < THROTTLE_MS) return;
      localStorage.setItem(LS_KEY, String(Date.now()));
    } catch {
      // localStorage 不可用时仍执行（refreshDue 自身有 interval 节流）
    }
    setMsg("自动刷新中…");
    fetch("/api/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ force: false }),
    })
      .then((r) => r.json())
      .then((j: { bindings?: number; added?: number; updated?: number; results?: { ok?: boolean }[] }) => {
        if (!j.bindings) {
          setMsg(null); // 没有到期的源：保持安静
          return;
        }
        const fails = (j.results ?? []).filter((r) => r.ok === false).length;
        setMsg(
          `自动刷新：+${j.added ?? 0} 新 · ${j.updated ?? 0} 更${fails ? ` · ${fails} 个源失败` : ""}`,
        );
        router.refresh();
        setTimeout(() => setMsg(null), 12_000);
      })
      .catch(() => setMsg(null));
  }, [router]);

  return msg ? <span className="auto-msg">{msg}</span> : null;
}
