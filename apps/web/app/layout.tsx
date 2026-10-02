import "../../../shared/theme.css";
import "./monochrome.css";
import { site } from "../site.config";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  metadataBase: new URL(site.url),
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <a className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              +
            </span>
            {site.name}
          </a>
          <nav aria-label="Main navigation">
            <a href="/#projects">Projects</a>
            <a href="https://github.com/buckles3636/pbengblog">Source</a>
          </nav>
        </header>
        <main id="main" className="shell">
          {children}
        </main>
        <footer>
          <span>
            © {new Date().getFullYear()} {site.author}
          </span>
          <span>
            Built with PBEngBlog /{" "}
            <a href="/demo/GENERATED-IMAGES.md">Image notes</a>
          </span>
        </footer>
      </body>
    </html>
  );
}
