import type { ItemVM } from "@/lib/types";
import { IconPlay, PlatformIcon } from "../icons";
import { hideBrokenImage, sqClass, thumbClass } from "./shared";

export function CardMedia({ it, dur }: { it: ItemVM; dur: string | null }) {
  const isVideoCard = it.platform === "youtube" || it.platform === "bilibili";
  const thumbnailReferrerPolicy = it.platform === "bilibili" ? "no-referrer" : undefined;

  if (isVideoCard) {
    return (
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
  }

  if (it.platform === "x" && it.postKind === "video" && it.thumbnailUrl) {
    return (
      <div className="thumb t1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={it.thumbnailUrl} alt="" onError={hideBrokenImage} />
        <div className="play">
          <IconPlay />
        </div>
      </div>
    );
  }

  return (
    <div className={`sq ${sqClass(it.platform)}`}>
      <PlatformIcon platform={it.platform} />
    </div>
  );
}
