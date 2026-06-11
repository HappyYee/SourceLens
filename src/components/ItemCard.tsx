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
}: {
  it: ItemVM;
  timeLabel: string;
  onDelete?: () => void;
  onEditTitle?: () => void;
}) {
  const dur = formatDuration(it.durationSec);
  const r = getCardRenderer(it.platform);
  const tags = [...(it.youtubePlaylistTags ?? []), ...(it.platformTags ?? [])];

  return (
    <div className="item">
      {r.media(it, dur)}
      <div className="it-body">
        <div className="it-meta">
          <span className="src">
            <PlatformIcon platform={it.platform} /> {r.srcLabel(it)}
          </span>
          {r.metaExtra?.(it, dur)}
          <StatusBadge it={it} />
          <span className="it-time">{timeLabel}</span>
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

        <a className="it-link" href={it.url} target="_blank" rel="noopener noreferrer">
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
