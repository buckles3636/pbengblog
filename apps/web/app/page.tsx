import TagFilter from "../../../shared/TagFilter";
import { posts } from "../content";
import { site } from "../site.config";
import { safeUrl } from "../../../shared/content";

function EngineeringDrawing() {
  return (
    <svg
      className="hero-drawing"
      viewBox="0 0 600 520"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M30 0H0V30" stroke="currentColor" opacity=".09" />
        </pattern>
      </defs>
      <path fill="url(#grid)" d="M0 0H600V520H0z" />
      <g stroke="currentColor">
        <circle cx="300" cy="250" r="190" opacity=".2" />
        <circle cx="300" cy="250" r="145" strokeDasharray="3 8" opacity=".4" />
        <path d="M300 28V472M60 250H540" strokeDasharray="8 6" opacity=".3" />
        <g transform="translate(300 250) rotate(-30)">
          <path d="M-148-58H80L143-30V30L80 58H-148Z" fill="#141414" />
          <ellipse cx="-148" cy="0" rx="25" ry="58" fill="#141414" />
          <ellipse cx="80" cy="0" rx="25" ry="58" />
          <path d="M-130-45H66M-130-30H58M-130 30H58M-130 45H66" opacity=".5" />
          <path d="M110-14H200V14H110" fill="#141414" />
          <ellipse cx="200" cy="0" rx="6" ry="14" />
          <path d="M-100 58V84H36V58M-116 84H52V98H-116Z" />
          <circle cx="-148" cy="0" r="13" />
          <path d="M-175-100H145M-175-110V-90M145-110V-90" opacity=".5" />
        </g>
        <path d="M392 155L454 90H555M213 339L155 409H40" opacity=".6" />
        <path d="M22 40V22H40M560 22H578V40M22 480V498H40M560 498H578V480" />
      </g>
      <g
        fill="currentColor"
        fontFamily="monospace"
        fontSize="10"
        letterSpacing="1.5"
      >
        <text x="457" y="80">
          01 / DRIVE
        </text>
        <text x="40" y="430">
          02 / MOUNT
        </text>
        <text x="38" y="53">
          FIG. 001
        </text>
        <text x="38" y="478" opacity=".55">
          CONCEPT STUDY / NOT TO SCALE
        </text>
      </g>
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-topline">
          <span>Independent engineering</span>
          <span>Ideas / experiments / field notes</span>
        </div>
        <div className="hero-layout">
          <div className="hero-copy">
            <span className="eyebrow">An open engineering notebook</span>
            <h1>
              Build.
              <br />
              Measure.
              <br />
              <span>Document.</span>
            </h1>
            <p className="lede">{site.description}</p>
            <a className="project-link" href="#projects">
              Explore the projects <span aria-hidden="true">↗</span>
            </a>
          </div>
          <EngineeringDrawing />
        </div>
        <div className="hero-bottomline">
          <span>From first principles to working prototypes.</span>
          <span aria-hidden="true">↓</span>
        </div>
      </section>
      <section id="projects">
        <div className="section-title">
          <div>
            <span className="eyebrow">The project archive</span>
            <h2>
              Work in progress.
              <br />
              Lessons on record.
            </h2>
          </div>
          <span className="status">
            {String(posts.length).padStart(2, "0")} entries / Open notebook
          </span>
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
                      <span key={tag.id}>{tag.name}</span>
                    ))}
                  </div>
                  <div className="card-foot">
                    <span>
                      {new Date(p.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                    <span>Read field notes →</span>
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
