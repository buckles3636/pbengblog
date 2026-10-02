import "../../../shared/theme.css";
import "./editor.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "PBEngBlog · Editor",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="brand" href="/">
            <small>PB /</small>PBEngBlog
          </a>
          <div className="editor-header-actions">
            <span className="eyebrow">Private notebook</span>
            <div id="editor-session-actions" />
          </div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
