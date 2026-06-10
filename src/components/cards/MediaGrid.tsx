import type { XMedia } from "@/lib/types";
import { hideBrokenImage } from "./shared";

export function MediaGrid({ photos }: { photos: XMedia[] }) {
  return (
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
  );
}
