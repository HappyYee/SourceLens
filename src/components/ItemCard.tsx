import Link from "next/link";
import type { ItemVM } from "@/lib/types";
import { displayTitle, formatDuration } from "@/lib/view";
import { IconArrow, PlatformIcon } from "./icons";
import { getCardRenderer } from "./cards/registry";
import { StatusBadge } from "./cards/StatusBadge";
import { TagList } from "./cards/TagList";

export default function ItemCard({
  it,
  timeLabel,
  onDelete,
  onEditTitle,
  onToggleRead,
  onOpen,
  room,
}: {
  it: ItemVM;
  timeLabel: string;
  onDelete?: () => void;
  onEditTitle?: () => void;
  /** 勾选已读/未读（U2）。提供时显示勾选控件。 */
  onToggleRead?: () => void;
  /** 点击外链时回调（U2：自动标记已读），不阻止默认跳转。 */
  onOpen?: () => void;
  /** 跨 Room 流（首页新内容）里显示来源 Room 徽标。 */
  room?: { id: string; name: string };
}) {
  const dur = formatDuration(it.durationSec);
  const r = getCardRenderer(it.platform);
  const tags = [...(it.youtubePlaylistTags ?? []), ...(it.platformTags ?? [])];
  const isRead = !!it.readAt;

  return (
    <div className={isRead ? "item read" : "item"}>
      {r.media(it, dur)}
      <div className="it-body">
        <div className="it-meta">
          {room ? (
            <Link href={`/room/${room.id}`} className="it-room">
              {room.name}
            </Link>
          ) : null}
          <span className="src">
            <PlatformIcon platform={it.platform} /> {r.srcLabel(it)}
          </span>
          {r.metaExtra?.(it, dur)}
          <StatusBadge it={it} />
          <span className="it-time">{timeLabel}</span>
          {onToggleRead ? (
            <button
              type="button"
              className={isRead ? "it-readbtn on" : "it-readbtn"}
              title={isRead ? "标为未读" : "标为已读"}
              onClick={onToggleRead}
            >
              ✓
            </button>
          ) : null}
        </div>
        <div className="it-title">
          {displayTitle(it)}
          {onEditTitle ? (
            <button type="button" className="it-edit" title="编辑标题" onClick={onEditTitle}>
              ✎
            </button>
          ) : null}
        </div>
        {it.excerpt ? <div className="it-desc">{it.excerpt}</div> : null}

        {r.content?.(it)}

        {tags.length > 0 ? (
          <TagList tags={tags} />
        ) : null}

        <a
          className="it-link"
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpen}
        >
          {r.linkLabel} <IconArrow />
        </a>
      </div>
      {onDelete ? (
        <button type="button" className="it-del" title="删除此条" onClick={onDelete}>
          ✕
        </button>
      ) : null}
    </div>
  );
}
