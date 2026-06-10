import type { ItemVM, Platform } from "@/lib/types";
import { displayTitle, formatDuration } from "@/lib/view";
import {
  IconArrow,
  IconMic,
  IconPlay,
  IconSpark,
  PlatformIcon,
  platformLabel,
} from "./icons";

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

function thumbClass(v?: number | null): string {
  const n = (((v ?? 0) % 4) + 4) % 4;
  return `t${n}`;
}
function sqClass(p: Platform): string {
  if (p === "arxiv") return "s0";
  if (p === "podcast") return "s2";
  if (p === "bilibili") return "s3";
  return "s1";
}

function srcLabelFor(it: ItemVM): string {
  if (it.platform === "youtube" && it.youtubeKind === "short") return "YouTube · Shorts";
  if (it.platform === "bilibili") return it.videoKind === "short" ? "Bilibili · Short" : "Bilibili";
  if (it.platform === "x") return `X · ${X_KIND_LABEL[it.postKind ?? "text"] ?? "Post"}`;
  return platformLabel(it.platform);
}

function hideBrokenImage(e: { currentTarget: HTMLImageElement }): void {
  e.currentTarget.style.display = "none";
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
  const isVideoCard = it.platform === "youtube" || it.platform === "bilibili";
  const isPodcast = it.platform === "podcast";
  const aiTitled = it.platform === "x" && !it.title && !!it.aiTitle;
  const srcLabel = srcLabelFor(it);
  const tags = [...(it.youtubePlaylistTags ?? []), ...(it.platformTags ?? [])];
  const photos = (it.media ?? []).filter((m) => m.thumb);
  const links = it.linkCards ?? [];
  const isXQuoteWithoutQuoteCard =
    it.platform === "x" && it.postKind === "quote" && !links.some((c) => c.domain === "x.com");
  const thumbnailReferrerPolicy = it.platform === "bilibili" ? "no-referrer" : undefined;

  let media;
  if (isVideoCard) {
    media = (
      <div className={`thumb ${thumbClass(it.thumbVariant)}`}>
        {it.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={it.thumbnailUrl}
            alt=""
            referrerPolicy={thumbnailReferrerPolicy}
            onError={hideBrokenImage}
          />
        ) : null}
        <div className="play">
          <IconPlay />
        </div>
        {dur ? <div className="dur">{dur}</div> : null}
      </div>
    );
  } else if (it.platform === "x" && it.postKind === "video" && it.thumbnailUrl) {
    media = (
      <div className="thumb t1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={it.thumbnailUrl} alt="" onError={hideBrokenImage} />
        <div className="play">
          <IconPlay />
        </div>
      </div>
    );
  } else {
    media = (
      <div className={`sq ${sqClass(it.platform)}`}>
        <PlatformIcon platform={it.platform} />
      </div>
    );
  }

  return (
    <div className="item">
      {media}
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

        {it.platform === "x" && photos.length > 0 && it.postKind !== "video" ? (
          <div className={`it-mediagrid g${Math.min(photos.length, 4)}`}>
            {photos.slice(0, 4).map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="it-mthumb"
                key={i}
                src={m.thumb ?? ""}
                alt=""
                onError={hideBrokenImage}
              />
            ))}
          </div>
        ) : null}

        {it.platform === "x" && links.length > 0 ? (
          <div className="it-linkcards">
            {links.slice(0, 2).map((c, i) => (
              <a
                className="it-linkcard"
                key={i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="lc-domain">{c.domain || "链接"}</span>
                {c.title ? <span className="lc-title">{c.title}</span> : null}
              </a>
            ))}
          </div>
        ) : null}

        {isXQuoteWithoutQuoteCard ? (
          <div className="it-quote-fallback">引用了一条推文</div>
        ) : null}

        {tags.length > 0 ? (
          <div className="it-tags">
            {tags.slice(0, 3).map((t) => (
              <span className="it-tag" key={t}>
                #{t}
              </span>
            ))}
            {tags.length > 3 ? <span className="it-tag more">+{tags.length - 3}</span> : null}
          </div>
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
