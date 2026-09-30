import { posts } from "../content";
import { site } from "../site.config";
import { safeUrl } from "../../../shared/content";
export default function Home() {
  return (
    <>
      <section className="hero">
        <span className="eyebrow">An engineering notebook</span>
        <h1>{site.name}</h1>
        <p className="lede">{site.description}</p>
      </section>
      <section id="projects">
        <div className="section-title">
          <h2>Projects & field notes</h2>
          <span className="status">
            {String(posts.length).padStart(2, "0")} entries
          </span>
        </div>
        <div className="cards">
          {posts.map((p) => (
            <a className="card" href={`/${p.slug}`} key={p.id}>
              {p.cover && <img src={safeUrl(p.cover, true)} alt="" />}
              <span className="eyebrow">{p.category}</span>
              <h3>{p.title}</h3>
              <p>{p.summary}</p>
              <div className="card-foot">
                <span>
                  {new Date(p.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                <span>Read notebook ↗</span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
