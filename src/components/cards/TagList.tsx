export function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="it-tags">
      {tags.slice(0, 3).map((t) => (
        <span className="it-tag" key={t}>
          #{t}
        </span>
      ))}
      {tags.length > 3 ? <span className="it-tag more">+{tags.length - 3}</span> : null}
    </div>
  );
}
