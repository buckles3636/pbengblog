"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Post, Block } from "../../../shared/content";
import { ArticleBody, Outline } from "../../../shared/ArticleBody";
const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => <p>Loading notebook…</p>,
});
async function api(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
export default function Workspace() {
  const [posts, setPosts] = useState<Post[]>([]),
    [post, setPost] = useState<Post | null>(null),
    [status, setStatus] = useState("Loading…"),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [editorKey, setEditorKey] = useState(0),
    [history, setHistory] = useState<
      { version: number; created_at: string; snapshot: Post }[]
    >([]);
  const current = useRef<Post | null>(null),
    dirty = useRef(false),
    saving = useRef(false),
    changeCounter = useRef(0);
  function select(p: Post) {
    if (
      dirty.current &&
      !window.confirm("Unsaved changes remain. Leave this draft?")
    )
      return;
    current.current = p;
    dirty.current = false;
    setPost(p);
    setPreview(false);
    setHistory([]);
    setError("");
    setStatus(`Saved · revision ${p.version}`);
    setEditorKey((k) => k + 1);
  }
  function change(patch: Partial<Post>) {
    if (!current.current) return;
    current.current = { ...current.current, ...patch };
    dirty.current = true;
    changeCounter.current++;
    setPost(current.current);
    setStatus("Unsaved changes");
  }
  async function save() {
    if (!current.current || saving.current) return null;
    saving.current = true;
    setBusy(true);
    const p = current.current,
      counter = changeCounter.current;
    try {
      const saved = (await api(`/api/posts/${p.id}`, "PUT", p)) as Post;
      if (current.current?.id === p.id) {
        current.current =
          counter === changeCounter.current
            ? saved
            : { ...current.current, version: saved.version };
        dirty.current = counter !== changeCounter.current;
        setPost(current.current);
        setStatus(
          dirty.current
            ? "Unsaved changes"
            : `Saved · revision ${saved.version}`,
        );
      }
      setPosts((items) =>
        items.map((item) => (item.id === saved.id ? saved : item)),
      );
      setError("");
      return saved;
    } catch (e) {
      setError((e as Error).message);
      setStatus("Save failed — draft remains in this tab");
      return null;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    api("/api/posts")
      .then((items) => {
        setPosts(items);
        if (items[0]) select(items[0]);
        else setStatus("Create your first article");
      })
      .catch((e) => {
        setError(e.message);
        setStatus("Unable to load posts");
      });
    const interval = setInterval(() => {
      if (dirty.current && !saving.current) void save();
    }, 5000);
    const before = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", before);
    };
  }, []);
  async function create() {
    setBusy(true);
    try {
      const p = await api("/api/posts", "POST", {
        title: "Untitled project",
        slug: `project-${crypto.randomUUID().slice(0, 8)}`,
        summary: "",
        category: "Projects",
        cover: "",
        blocks: [],
      });
      setPosts((items) => [p, ...items]);
      select(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    const p = dirty.current ? await save() : current.current;
    if (!p || dirty.current) return;
    setBusy(true);
    try {
      const published = await api(`/api/posts/${p.id}/publish`, "POST", {
        version: p.version,
      });
      current.current = published;
      setPost(published);
      setPosts((items) =>
        items.map((item) => (item.id === p.id ? published : item)),
      );
      setStatus(
        "Published snapshot saved · run npm run publish to export the website",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar">
        <span className="eyebrow">Your workspace</span>
        <span className="status" role="status">
          {status}
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="editor-layout">
        <aside className="post-list">
          <button className="primary" onClick={create} disabled={busy}>
            ＋ New article
          </button>
          {posts.map((p) => (
            <button
              key={p.id}
              className={post?.id === p.id ? "selected" : ""}
              onClick={() => select(p)}
              disabled={busy}
            >
              {p.title}
              <small>
                {p.published ? "Published" : "Draft"} · /{p.slug}
              </small>
            </button>
          ))}
        </aside>
        <section>
          {post ? (
            <>
              <div className="toolbar">
                <button onClick={() => void save()} disabled={busy}>
                  Save draft
                </button>
                <button onClick={() => setPreview((p) => !p)}>
                  {preview ? "Edit" : "Preview"}
                </button>
                <button onClick={publish} disabled={busy} className="primary">
                  Publish snapshot
                </button>
                <button
                  onClick={() =>
                    api(`/api/posts/${post.id}/revisions`)
                      .then(setHistory)
                      .catch((e) => setError(e.message))
                  }
                >
                  History
                </button>
              </div>
              <div className="editor-meta">
                <label className="wide">
                  Article title
                  <input
                    value={post.title}
                    onChange={(e) => change({ title: e.target.value })}
                  />
                </label>
                <label>
                  URL slug
                  <input
                    value={post.slug}
                    onChange={(e) => change({ slug: e.target.value })}
                  />
                </label>
                <label>
                  Category
                  <input
                    value={post.category}
                    onChange={(e) => change({ category: e.target.value })}
                  />
                </label>
                <label className="wide">
                  Short description
                  <textarea
                    value={post.summary}
                    onChange={(e) => change({ summary: e.target.value })}
                  />
                </label>
                <label className="wide">
                  Cover image URL
                  <input
                    value={post.cover}
                    placeholder="Optional — upload an image in the article and reuse its URL"
                    onChange={(e) => change({ cover: e.target.value })}
                  />
                </label>
              </div>
              {history.length > 0 && (
                <div className="revision-list">
                  {history.map((r) => (
                    <button
                      key={r.version}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Restore revision ${r.version} into the draft? The current draft will remain in history after saving.`,
                          )
                        ) {
                          change({
                            ...r.snapshot,
                            id: post.id,
                            version: post.version,
                            published: post.published,
                          });
                          setEditorKey((k) => k + 1);
                        }
                      }}
                    >
                      Restore r{r.version}
                    </button>
                  ))}
                </div>
              )}
              <p className="editor-hint">
                Paste images directly. Type / for headings, lists, and
                equations. Autosaves every five seconds; the website controls
                typography.
              </p>
              {preview ? (
                <>
                  <div className="preview-label">Draft preview</div>
                  <h1>{post.title}</h1>
                  <ArticleBody blocks={post.blocks} />
                </>
              ) : (
                <div className="article-grid">
                  <div className="editing-area">
                    <Editor
                      key={`${post.id}-${editorKey}`}
                      blocks={post.blocks}
                      onChange={(blocks: Block[]) => change({ blocks })}
                    />
                  </div>
                  <Outline blocks={post.blocks} editor />
                </div>
              )}
            </>
          ) : (
            <div className="empty">
              Create an article to start your notebook.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
