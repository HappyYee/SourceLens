import Link from "next/link";
import { getHomeRooms, getRefreshStatus } from "@/lib/data";
import type { RoomVM } from "@/lib/types";
import { IconArrow, PlatformIcon } from "@/components/icons";
import AutoRefresh from "@/components/AutoRefresh";
import RefreshButton from "@/components/RefreshButton";
import {
  agoLabel,
  displayTitle,
  formatRelativeTime,
  impCells,
  updCount,
} from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const now = new Date();
  let rooms: RoomVM[] = [];
  try {
    rooms = await getHomeRooms();
  } catch {
    rooms = [];
  }
  let lastFetchedAt: Date | null = null;
  let oldestFetchedAt: Date | null = null;
  try {
    const st = await getRefreshStatus();
    lastFetchedAt = st.lastFetchedAt;
    oldestFetchedAt = st.oldestFetchedAt;
  } catch {
    /* 状态标签缺席不影响首页 */
  }
  const staleDays = oldestFetchedAt
    ? Math.floor((now.getTime() - oldestFetchedAt.getTime()) / 86_400_000)
    : 0;

  return (
    <>
      <div className="topbar">
        <div className="crumb">源镜 / 今日总览</div>
        <div className="spacer" />
        <span className="topbar-meta" suppressHydrationWarning>
          {lastFetchedAt ? `上次刷新 ${agoLabel(lastFetchedAt, now)}` : ""}
          {staleDays > 7 ? (
            <em className="topbar-warn" title="最久未刷新的源已超过 7 天。高产源的最新批次可能盖不住离开期间的全部内容，建议进入 Room 用「回溯历史」补齐。">
              · 离开较久，建议回溯
            </em>
          ) : null}
        </span>
        <AutoRefresh />
        <div className="seg">
          <button type="button" className="on">
            重要性
          </button>
          <button type="button">最近更新</button>
        </div>
        <RefreshButton label="检查更新" />
      </div>

      <div className="content">
        <div className="h-head">
          <h1 className="h-title">今日总览</h1>
          <span className="h-sub">按重要性排序 · 顺序由你掌控</span>
        </div>
        <p className="h-note">
          每个方块是一个 <b>room</b>（一个你关注的对象）。大小与位置由你给它设的重要度决定，
          <b>不是算法推断</b>。点任意方块进入它的全平台时间线，或从左侧自定义分区进入。
        </p>

        {rooms.length === 0 ? (
          <div className="empty" style={{ textAlign: "left", lineHeight: 1.9 }}>
            还没有 Room。请先创建你真正关心的人、公司、项目或频道。
            <br />
            前往{" "}
            <Link href="/settings" style={{ color: "var(--accent)" }}>
              设置页
            </Link>{" "}
            新建 Room，进入 Room 后在"来源 Sources"里添加 YouTube / RSS 等来源。
          </div>
        ) : (
          <div className="grid">
            {rooms.map((r, idx) => {
              const feature = idx === 0;
              const peeks = r.items.slice(0, 2);
              return (
                <Link
                  key={r.id}
                  href={`/room/${r.id}`}
                  className={`tile ${feature ? "feature" : ""}`}
                >
                  <span className="enter-hint">
                    <IconArrow />
                  </span>
                  <div className="tile-top">
                    <span className="tile-name">{r.name}</span>
                  </div>
                  <div className="tile-meta">
                    <span className="plats">
                      {r.bindings.map((b) => (
                        <PlatformIcon key={b} platform={b} />
                      ))}
                    </span>
                    <span className="tile-type">{r.typeLabel ?? r.type ?? ""}</span>
                    <span className="imp-row">
                      {impCells(r.importance).map((on, i) => (
                        <i key={i} className={on ? "on" : ""} />
                      ))}
                    </span>
                  </div>
                  <div className="tile-upd">● 今日 {updCount(r, now)} 条更新</div>
                  <div className="peek">
                    {peeks.length === 0 ? (
                      <div className="peek-item">
                        <span className="pi-t" style={{ color: "var(--ink-3)" }}>
                          暂无内容 · 加来源后点刷新
                        </span>
                      </div>
                    ) : (
                      peeks.map((it) => (
                        <div className="peek-item" key={it.id}>
                          <span className="pi-ic">
                            <PlatformIcon platform={it.platform} />
                          </span>
                          <span className="pi-t">{displayTitle(it)}</span>
                          <span className="pi-time">
                            {formatRelativeTime(it.publishedAt, now)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="foot">
          <b>Follow sources, not feeds.</b>
          <br />
          数据模型：一个 ROOM = 一组源绑定（X / YouTube / Blog / arXiv …），每条抓回的内容统一成带时间戳的对象，room
          时间线 = 按时间归并排序。
          <br />
          AI 在 v0 仅出现一处：推文无标题时自动拟题（卡片上的{" "}
          <span style={{ color: "var(--accent)" }}>✦ AI 拟题</span> 标记）。其余智能为后续可选副驾。
        </div>
      </div>
    </>
  );
}
