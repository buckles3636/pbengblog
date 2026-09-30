"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Tag } from "./content";
export default function TagFilter({
  items,
  className,
}: {
  items: { id: string; tags: Tag[]; content: ReactNode }[];
  className: string;
}) {
  const [active, setActive] = useState("");
  const tags = [
    ...new Map(items.flatMap((p) => p.tags).map((t) => [t.id, t])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  useEffect(() => {
    const sync = () =>
      setActive(new URLSearchParams(location.search).get("tag") ?? "");
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function select(id: string) {
    setActive(id);
    const url = new URL(location.href);
    if (id) url.searchParams.set("tag", id);
    else url.searchParams.delete("tag");
    url.hash = "projects";
    history.pushState(null, "", url);
  }
  const visible = active
    ? items.filter((p) => p.tags.some((t) => t.id === active))
    : items;
  return (
    <>
      {tags.length > 0 && (
        <div
          className="tag-filter"
          role="group"
          aria-label="Filter projects by tag"
        >
          <button
            type="button"
            aria-pressed={!active}
            onClick={() => select("")}
          >
            All projects
          </button>
          {tags.map((t) => (
            <button
              type="button"
              key={t.id}
              aria-pressed={active === t.id}
              onClick={() => select(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
      <p className="tag-result" role="status">
        {visible.length} {visible.length === 1 ? "project" : "projects"}
        {active ? " matching this tag" : ""}
      </p>
      <div className={className}>
        {visible.map((item) => (
          <div className="tag-filter-item" key={item.id}>
            {item.content}
          </div>
        ))}
      </div>
      {!visible.length && (
        <p>
          No projects match this tag.{" "}
          <button type="button" onClick={() => select("")}>
            Show all projects
          </button>
        </p>
      )}
    </>
  );
}
