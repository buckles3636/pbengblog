import { EntryDate } from "../../../shared/EntryDate";
import { tagStyle } from "../../../shared/tag-colors";
import TagFilter from "../../../shared/TagFilter";
import { posts } from "../content";
import { site } from "../site.config";
import { safeUrl } from "../../../shared/content";

export default function Home() {
  return (
    <>
      <section className="hero">
        <span className="eyebrow">{site.author} / Notebook</span>
        <h1>{site.name}</h1>
        <p className="lede">{site.description}</p>
      </section>
      <section id="projects">
        <div className="section-title">
          <h2>Projects</h2>
          <span className="status">{posts.length} entries</span>
        </div>
        <TagFilter
          className="cards"
          items={posts.map((p, index) => ({
            id: p.id,
            tags: p.tags ?? [],
            content: (
              <a className="card" href={`/${p.slug}`} key={p.id}>
                <div className="card-index">
                  <span>Project / {String(index + 1).padStart(2, "0")}</span>
                  <span aria-hidden="true">↗</span>
                </div>
                {p.cover && (
                  <div className="card-image">
                    <img src={safeUrl(p.cover, true)} alt="" />
                  </div>
                )}
                <div className="card-copy">
                  <span className="eyebrow">{p.category}</span>
                  <h3>{p.title}</h3>
                  <p>{p.summary}</p>
                  <div className="card-tags">
                    {p.tags?.map((tag) => (
                      <span key={tag.id} style={tagStyle(tag)}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                  <div className="card-foot">
                    <EntryDate value={p.entryDate} />
                    <span>Read article →</span>
                  </div>
                </div>
              </a>
            ),
          }))}
        />
      </section>
    </>
  );
}
