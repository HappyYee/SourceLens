import type { ItemVM } from "@/lib/types";
import { LinkPreview } from "./LinkPreview";
import { MediaGrid } from "./MediaGrid";

export function XPostCard({ it }: { it: ItemVM }) {
  const photos = (it.media ?? []).filter((m) => m.thumb);
  const links = it.linkCards ?? [];
  const isXQuoteWithoutQuoteCard =
    it.postKind === "quote" && !links.some((c) => c.domain === "x.com");

  return (
    <>
      {photos.length > 0 && it.postKind !== "video" ? (
        <MediaGrid photos={photos} />
      ) : null}

      {links.length > 0 ? (
        <LinkPreview links={links} />
      ) : null}

      {isXQuoteWithoutQuoteCard ? (
        <div className="it-quote-fallback">引用了一条推文</div>
      ) : null}
    </>
  );
}
