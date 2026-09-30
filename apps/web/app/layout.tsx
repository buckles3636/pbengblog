import "../../../shared/theme.css";
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
        <header className="site-header">
          <a className="brand" href="/">
            {site.name}
          </a>
          <nav>
            <a href="/#projects">Projects</a>
            <a href="https://github.com/buckles3636/pbengblog">Source</a>
          </nav>
        </header>
        <main className="shell">{children}</main>
        <footer>
          © {new Date().getFullYear()} {site.author} · Built with PBEngBlog
        </footer>
      </body>
    </html>
  );
}
