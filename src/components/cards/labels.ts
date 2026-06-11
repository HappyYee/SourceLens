export const X_KIND_LABEL: Record<string, string> = {
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

export function xSrcLabel(postKind?: string | null): string {
  return `X · ${X_KIND_LABEL[postKind ?? "text"] ?? "Post"}`;
}

export function youtubeSrcLabel(youtubeKind?: string | null): string | null {
  return youtubeKind === "short" ? "YouTube · Shorts" : null;
}

export function bilibiliSrcLabel(videoKind?: string | null): string {
  return videoKind === "short" ? "Bilibili · Short" : "Bilibili";
}
