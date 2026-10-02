"use client";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import HistoryPanel, { type Revision } from "./HistoryPanel";
import {
  publicationActive,
  type PublicationStatus,
} from "../../../shared/publication";
import { useEffect, useRef, useState } from "react";
import type { Post, Block } from "../../../shared/content";
import { ArticleBody, Outline } from "../../../shared/ArticleBody";
import TagPicker from "./TagPicker";
import CoverImage from "./CoverImage";
import PublicationNotice from "./PublicationNotice";
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
    [tagFilter, setTagFilter] = useState(""),
    [search, setSearch] = useState(""),
    [publication, setPublication] = useState<PublicationStatus | null>(null),
    [publicationError, setPublicationError] = useState(""),
    [sessionActions, setSessionActions] = useState<HTMLElement | null>(null),
    [busy, setBusy] = useState(false),
    [coverUploading, setCoverUploading] = useState(false),
    [editorKey, setEditorKey] = useState(0),
    [historyOpen, setHistoryOpen] = useState(false);
  const current = useRef<Post | null>(null),
    dirty = useRef(false),
    saving = useRef(false),
    changeCounter = useRef(0),
    publishStarting = useRef(false),
    publishRequest = useRef<{ key: string; id: string } | null>(null);
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
    setHistoryOpen(false);
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
  async function refreshPublication() {
    const value = (await api("/api/publications")) as PublicationStatus;
    setPublication(value);
    setPublicationError("");
  }
  useEffect(() => {
    setSessionActions(document.getElementById("editor-session-actions"));
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const value = (await api("/api/publications")) as PublicationStatus;
        if (!stopped) {
          setPublication(value);
          setPublicationError("");
        }
      } catch {
        if (!stopped)
          setPublicationError(
            "Unable to check publishing progress. Reconnecting…",
          );
      }
      if (!stopped) timer = setTimeout(poll, 4000);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);
  async function restoreRevision(revision: Revision) {
    if (
      !current.current ||
      !window.confirm(
        `Restore revision ${revision.version} as a new draft? Existing revisions will be kept.`,
      )
    )
      return;
    if (dirty.current) {
      await save();
      if (dirty.current) return;
    }
    const latest = current.current;
    change({
      ...revision.snapshot,
      tags: revision.snapshot.tags || [],
      id: latest.id,
      version: latest.version,
      published: latest.published,
    });
    setEditorKey((key) => key + 1);
    setPreview(false);
    if (await save()) setHistoryOpen(false);
  }
  async function logout() {
    if (dirty.current) {
      await save();
      if (dirty.current) return;
    }
    try {
      await api("/api/auth/logout", "POST");
      window.location.assign("/login");
    } catch (error) {
      setError((error as Error).message);
    }
  }
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
    if (publishStarting.current) return;
    publishStarting.current = true;
    try {
      const p = dirty.current ? await save() : current.current;
      if (!p || dirty.current) return;
      setBusy(true);
      setError("");
      if (publication?.enabled) {
        const key = `${p.id}:${p.version}`;
        if (publishRequest.current?.key !== key)
          publishRequest.current = { key, id: crypto.randomUUID() };
        const result = await api("/api/publications", "POST", {
          postId: p.id,
          version: p.version,
          requestId: publishRequest.current.id,
        });
        publishRequest.current = null;
        setPublication((value) =>
          value ? { ...value, job: result.job } : value,
        );
        const { published: _published, notionId: _notionId, ...snapshot } = p;
        if (current.current?.id === p.id) {
          current.current = { ...current.current, published: snapshot };
          setPost(current.current);
        }
        setPosts((items) =>
          items.map((item) =>
            item.id === p.id ? { ...item, published: snapshot } : item,
          ),
        );
      } else {
        const saved = await api(`/api/posts/${p.id}/publish`, "POST", {
          version: p.version,
        });
        if (current.current?.id === p.id) {
          current.current = { ...current.current, published: saved.published };
          setPost(current.current);
        }
        setPosts((items) =>
          items.map((item) =>
            item.id === p.id ? { ...item, published: saved.published } : item,
          ),
        );
        setStatus("Snapshot saved");
      }
    } catch (error) {
      setError((error as Error).message);
      void refreshPublication().catch(() => {});
    } finally {
      setBusy(false);
      publishStarting.current = false;
    }
  }
  const filteredPosts = posts.filter((p) => {
    const query = search.trim().toLocaleLowerCase();
    const haystack = [
      p.title,
      p.summary,
      ...(p.tags || []).map((tag) => tag.name),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      (!tagFilter || p.tags?.some((tag) => tag.id === tagFilter)) &&
      (!query || haystack.includes(query))
    );
  });
  const deploymentBusy = publicationActive(publication?.job || null);
  return (
    <>
      {sessionActions &&
        createPortal(
          <>
            {publication?.siteUrl && (
              <a
                className="website-link"
                href={publication.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View website ↗
              </a>
            )}
            <button
              className="sign-out"
              onClick={logout}
              disabled={busy || coverUploading}
            >
              Sign out
            </button>
          </>,
          sessionActions,
        )}
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1>A little space to make something.</h1>
          <p className="workspace-intro">
            Your projects, ideas, and works in progress.
          </p>
        </div>
        <span className="save-status" role="status">
          {status}
        </span>
      </div>
      <PublicationNotice publication={publication} error={publicationError} />
      {error && (
        <p className="error" role="alert">
          {error}{" "}
          {error.includes("Session expired") && (
            <a href="/login" target="_blank" rel="noopener noreferrer">
              Open sign in
            </a>
          )}
        </p>
      )}
      <div className="editor-layout">
        <aside className="post-list" aria-label="Article library">
          <div className="library-heading">
            <h2>Your articles</h2>
            <span>{posts.length}</span>
          </div>
          <div className="sidebar-tools">
            <button
              className="primary"
              onClick={create}
              disabled={busy || coverUploading}
            >
              ＋ New article
            </button>
            <label className="article-search">
              Search articles
              <input
                type="search"
                placeholder="Search titles, summaries, tags…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
              Tags
              <select
                aria-label="Filter by tag"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              >
                <option value="">All tags</option>
                {[
                  ...new Map(
                    posts.flatMap((p) => p.tags ?? []).map((t) => [t.id, t]),
                  ).values(),
                ]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p className="article-count">
            {filteredPosts.length}{" "}
            {filteredPosts.length === 1 ? "article" : "articles"}
          </p>
          <div className="article-list">
            {filteredPosts.map((p) => (
              <button
                key={p.id}
                className={post?.id === p.id ? "selected" : ""}
                onClick={() => select(p)}
                disabled={busy || coverUploading}
              >
                {p.title}
                <small>
                  {p.published
                    ? p.version > p.published.version
                      ? "Unpublished changes"
                      : "Saved"
                    : "Draft"}
                  {p.entryDate ? ` · ${p.entryDate}` : ""}
                </small>
              </button>
            ))}
            {!filteredPosts.length && (
              <div className="sidebar-empty">
                <p>No articles match your search.</p>
                <button
                  onClick={() => {
                    setSearch("");
                    setTagFilter("");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </aside>
        <section className="document-panel">
          {post ? (
            <>
              <div className="toolbar">
                <button
                  onClick={() => void save()}
                  disabled={busy || coverUploading}
                >
                  Save draft
                </button>
                <button onClick={() => setPreview((p) => !p)}>
                  {preview ? "Edit" : "Preview"}
                </button>
                <button
                  onClick={publish}
                  disabled={
                    busy ||
                    coverUploading ||
                    !publication ||
                    !!publicationError ||
                    (publication.enabled &&
                      (!publication.available || deploymentBusy))
                  }
                  className="primary"
                >
                  {publication?.enabled
                    ? deploymentBusy
                      ? "Publishing…"
                      : "Publish to website"
                    : "Save snapshot"}
                </button>
                <button
                  onClick={() => setHistoryOpen((open) => !open)}
                  aria-expanded={historyOpen}
                  aria-controls="revision-history"
                >
                  History
                </button>
              </div>
              {historyOpen && (
                <HistoryPanel
                  postId={post.id}
                  version={post.version}
                  busy={busy || coverUploading}
                  onRestore={restoreRevision}
                  onClose={() => setHistoryOpen(false)}
                />
              )}
              <div className="document-content">
                <div className="article-intro">
                  <label className="wide">
                    Article title
                    <input
                      value={post.title}
                      onChange={(e) => change({ title: e.target.value })}
                    />
                  </label>
                  <label className="wide">
                    Short description
                    <textarea
                      value={post.summary}
                      onChange={(e) => change({ summary: e.target.value })}
                    />
                  </label>
                </div>
                <CoverImage
                  key={post.id}
                  value={post.cover}
                  disabled={busy}
                  onUploading={setCoverUploading}
                  onChange={(cover) => {
                    if (current.current?.id === post.id) change({ cover });
                  }}
                />
                <details className="article-settings">
                  <summary>
                    <span>Article details</span>
                    <small>Date, URL, category & tags</small>
                  </summary>
                  <div className="editor-meta">
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
                      Entry date
                      <input
                        value={post.entryDate ?? ""}
                        placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
                        aria-label="Entry date"
                        aria-describedby="entry-date-hint"
                        onChange={(e) => change({ entryDate: e.target.value })}
                      />
                      <small id="entry-date-hint">
                        When this project or entry was made, independent of
                        later edits. Leave blank if unknown.
                      </small>
                    </label>
                  </div>
                  <TagPicker
                    key={post.id}
                    selected={post.tags ?? []}
                    onChange={(tags) => {
                      if (current.current?.id === post.id) change({ tags });
                    }}
                    disabled={busy || coverUploading}
                  />
                </details>
                <div className="writing-heading">
                  <h2>Write your story</h2>
                  <span>Autosaved as you go</span>
                </div>
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
              </div>
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
