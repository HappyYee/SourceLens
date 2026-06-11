import type { ItemVM, Platform } from "@/lib/types";
import { displayTitle, formatDuration } from "@/lib/view";
import {
  IconArrow,
  IconMic,
  IconSpark,
  PlatformIcon,
  platformLabel,
} from "./icons";
import { CardMedia } from "./cards/CardMedia";
import { TagList } from "./cards/TagList";
import { XPostCard } from "./cards/XPostCard";

const LINK_LABEL: Record<Platform, string> = {
  youtube: "在 YouTube 查看",
  bilibili: "在 B 站查看",
  podcast: "收听",
  arxiv: "查看预印本",
  rss: "阅读原文",
  github: "在 GitHub 查看",
  x: "在 X 查看",
  manual: "打开链接",
};

const X_KIND_LABEL: Record<string, string> = {
  text: "Post",
  image: "Image",
  video: "Video",
  link: "Link",
  quote: "Quote",
  reply: "Reply",
  repost: "Repost",
  thread: "Thread",
  unknown: "Post",
};

function srcLabelFor(it: ItemVM): string {
  if (it.platform === "youtube" && it.youtubeKind === "short") return "YouTube · Shorts";
  if (it.platform === "bilibili") return it.videoKind === "short" ? "Bilibili · Short" : "Bilibili";
  if (it.platform === "x") return `X · ${X_KIND_LABEL[it.postKind ?? "text"] ?? "Post"}`;
  return platformLabel(it.platform);
}

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
  const isPodcast = it.platform === "podcast";
  const aiTitled = it.platform === "x" && !it.title && !!it.aiTitle;
  const srcLabel = srcLabelFor(it);
  const tags = [...(it.youtubePlaylistTags ?? []), ...(it.platformTags ?? [])];

  return (
    <div className="item">
      <CardMedia it={it} dur={dur} />
      <div className="it-body">
        <div className="it-meta">
          <span className="src">
            <PlatformIcon platform={it.platform} /> {srcLabel}
          </span>
          {isPodcast && dur ? (
            <span className="src">
              <IconMic /> {dur}
            </span>
          ) : null}
          {aiTitled ? (
            <span className="ai-pill">
              <IconSpark /> AI 拟题
            </span>
          ) : null}
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

        {it.platform === "x" ? <XPostCard it={it} /> : null}

        {tags.length > 0 ? (
          <TagList tags={tags} />
        ) : null}

        <a className="it-link" href={it.url} target="_blank" rel="noopener noreferrer">
          {LINK_LABEL[it.platform] ?? "打开"} <IconArrow />
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
