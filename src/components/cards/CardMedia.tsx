import type { Platform } from "@/lib/types";
import { IconPlay, PlatformIcon } from "../icons";
import { hideBrokenImage, sqClass, thumbClass } from "./shared";

export function VideoThumb({
  thumbnailUrl,
  dur,
  thumbVariant,
  referrerPolicy,
}: {
  thumbnailUrl?: string | null;
  dur: string | null;
  thumbVariant?: number | null;
  referrerPolicy?: "no-referrer";
}) {
  return (
    <div className={`thumb ${thumbClass(thumbVariant)}`}>
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          referrerPolicy={referrerPolicy}
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

export function XVideoThumb({ thumbnailUrl }: { thumbnailUrl: string }) {
  return (
    <div className="thumb t1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbnailUrl} alt="" onError={hideBrokenImage} />
      <div className="play">
        <IconPlay />
      </div>
    </div>
  );
}

export function IconTile({ platform }: { platform: Platform }) {
  return (
    <div className={`sq ${sqClass(platform)}`}>
      <PlatformIcon platform={platform} />
    </div>
  );
}
