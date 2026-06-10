import { NextResponse } from "next/server";
import { refreshDue } from "@/lib/fetcher";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 抓取所有到期 binding。
// body: { roomId?, scope?: "today"|"range"|"all", since?, until?, force? }
// - today: 只收今天的；range: 收 [since, until]（向更早翻页）；all: 尽量收全部历史；
// - 省略 scope（自动/cron）：收当前 feed 的最新条目（按 interval 节流）。
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const roomId = typeof body.roomId === "string" ? body.roomId : undefined;
  const scope = typeof body.scope === "string" ? body.scope : undefined;

  let since: Date | undefined;
  let until: Date | undefined;
  let deep = false;

  if (scope === "today") {
    since = new Date();
    since.setHours(0, 0, 0, 0);
    until = new Date();
  } else if (scope === "all") {
    until = new Date();
    deep = true;
  } else if (scope === "range") {
    since = body.since ? new Date(body.since as string) : undefined;
    until = body.until ? new Date(body.until as string) : undefined;
    deep = true;
    if (since && Number.isNaN(+since)) since = undefined;
    if (until && Number.isNaN(+until)) until = undefined;
  }

  // 手动选了 scope 一律强制（忽略 interval）；省略 scope 时尊重 body.force（cron 用）
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
