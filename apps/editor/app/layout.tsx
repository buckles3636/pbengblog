import "../../../shared/theme.css";
import "../../../shared/template-theme.css";
import "./editor.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "PBEngBlog · Editor",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="editor-app">
        <header className="site-header">
          <a className="brand" href="/">
            <span className="editor-brand-mark" aria-hidden="true">
              +
            </span>
            <span>
              PBEngBlog<small>Your writing studio</small>
            </span>
          </a>
          <div className="editor-header-actions">
            <div id="editor-session-actions" />
          </div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
