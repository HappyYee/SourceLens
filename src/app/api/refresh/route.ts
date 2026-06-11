import { NextResponse } from "next/server";
import { refreshDue } from "@/lib/fetcher";
import { parseScope, scopeWindow } from "@/lib/refresh-scope";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 抓取所有到期 binding。
// body: { roomId?, scope?: "today"|"range"|"all", since?, until?, force? }
// - today: 只收今天的；range: 收 [since, until]（向更早翻页）；all: 尽量收全部历史；
// - 省略 scope（自动/cron）：收当前 feed 的最新条目（按 interval 节流）。
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const roomId = typeof body.roomId === "string" ? body.roomId : undefined;
  const scope = parseScope(body.scope);
  const { since, until, deep } = scopeWindow(
    scope,
    new Date(),
    typeof body.since === "string" ? body.since : undefined,
    typeof body.until === "string" ? body.until : undefined,
  );

  // 手动选了 scope 一律强制（忽略 interval）；省略 scope 时尊重 body.force
  // （检查更新按钮传 force=true；启动自动刷新传 force=false 走 interval 节流）
  const force = scope !== undefined || body.force === true;

  try {
    const res = await refreshDue({ roomId, since, until, deep, force });
    return NextResponse.json({ ...res, scope: scope ?? "recent" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "刷新失败" },
      { status: 500 },
    );
  }
}
