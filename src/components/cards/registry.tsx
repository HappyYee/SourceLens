import type { ReactNode } from "react";
import type { ItemVM, Platform } from "@/lib/types";
import { IconMic, IconSpark, platformLabel } from "../icons";
import { bilibiliSrcLabel, xSrcLabel, youtubeSrcLabel } from "./labels";
import { IconTile, VideoThumb, XVideoThumb } from "./CardMedia";
import { XPostCard } from "./XPostCard";

interface CardRenderer {
  srcLabel: (it: ItemVM) => string;
  linkLabel: string;
  media: (it: ItemVM, dur: string | null) => ReactNode;
  metaExtra?: (it: ItemVM, dur: string | null) => ReactNode;
  content?: (it: ItemVM) => ReactNode;
}

const DEFAULT_RENDERER: CardRenderer = {
  srcLabel: (it) => platformLabel(it.platform),
  linkLabel: "打开",
  media: (it) => <IconTile platform={it.platform} />,
};

const RENDERERS: Partial<Record<Platform, Partial<CardRenderer>>> = {
  youtube: {
    srcLabel: (it) => youtubeSrcLabel(it.youtubeKind) ?? platformLabel("youtube"),
    linkLabel: "在 YouTube 查看",
    media: (it, dur) => (
      <VideoThumb
        thumbnailUrl={it.thumbnailUrl}
        dur={dur}
        thumbVariant={it.thumbVariant}
        referrerPolicy={undefined}
      />
    ),
  },
  bilibili: {
    srcLabel: (it) => bilibiliSrcLabel(it.videoKind),
    linkLabel: "在 B 站查看",
    media: (it, dur) => (
      <VideoThumb
        thumbnailUrl={it.thumbnailUrl}
        dur={dur}
        thumbVariant={it.thumbVariant}
        referrerPolicy="no-referrer"
      />
    ),
  },
  x: {
    srcLabel: (it) => xSrcLabel(it.postKind),
    linkLabel: "在 X 查看",
    media: (it) =>
      it.postKind === "video" && it.thumbnailUrl ? (
        <XVideoThumb thumbnailUrl={it.thumbnailUrl} />
      ) : (
        <IconTile platform="x" />
      ),
    metaExtra: (it) =>
      !it.title && it.aiTitle ? (
        <span className="ai-pill">
          <IconSpark /> AI 拟题
        </span>
      ) : null,
    content: (it) => <XPostCard it={it} />,
  },
  podcast: {
    linkLabel: "收听",
    metaExtra: (_it, dur) =>
      dur ? (
        <span className="src">
          <IconMic /> {dur}
        </span>
      ) : null,
  },
  rss: {
    linkLabel: "阅读原文",
  },
  arxiv: {
    linkLabel: "查看预印本",
  },
  github: {
    linkLabel: "在 GitHub 查看",
  },
  manual: {
    linkLabel: "打开链接",
  },
};

export function getCardRenderer(p: Platform): CardRenderer {
  return { ...DEFAULT_RENDERER, ...RENDERERS[p] };
}
