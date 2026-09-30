import type { Tag } from "./content";
export function TagLinks({ tags = [] }: { tags?: Tag[] }) {
  return tags.length ? (
    <nav className="tag-links" aria-label="Article tags">
      {tags.map((tag) => (
        <a key={tag.id} href={`/?tag=${encodeURIComponent(tag.id)}#projects`}>
          {tag.name}
        </a>
      ))}
    </nav>
  ) : null;
}
