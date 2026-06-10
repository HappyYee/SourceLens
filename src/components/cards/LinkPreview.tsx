import type { LinkCard } from "@/lib/types";

export function LinkPreview({ links }: { links: LinkCard[] }) {
  return (
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
  );
}
