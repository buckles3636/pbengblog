"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IdeaInput, ProjectIdea } from "../../../shared/ideas";
import type { Tag } from "../../../shared/content";
import { tagStyle } from "../../../shared/tag-colors";
import TagPicker from "./TagPicker";
const empty = (): IdeaInput => ({
  title: "",
  details: "",
  tags: [],
  done: false,
});
async function api(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Unable to update ideas.");
  return data;
}
export default function ProjectIdeas() {
  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [draft, setDraft] = useState<IdeaInput>(empty);
  const [editing, setEditing] = useState<ProjectIdea | null>(null);
  const [status, setStatus] = useState("open");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pickerKey, setPickerKey] = useState(0);
  const [header, setHeader] = useState<HTMLElement | null>(null);
  const leaving = useRef(false);
  const baseline = editing
    ? {
        title: editing.title,
        details: editing.details,
        tags: editing.tags,
        done: editing.done,
      }
    : empty();
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty && !leaving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  async function load(refreshPicker = false) {
    setLoading(true);
    try {
      const [items, allTags] = await Promise.all([
        api("/api/ideas"),
        api("/api/tags"),
      ]);
      setIdeas(items);
      setTags(allTags);
      setError("");
      if (refreshPicker) setPickerKey((k) => k + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setHeader(document.getElementById("editor-session-actions"));
    void load();
  }, []);
  function abandon() {
    return !dirty || window.confirm("Discard unsaved changes to this idea?");
  }
  function reset() {
    setDraft(empty());
    setEditing(null);
  }
  function edit(idea: ProjectIdea) {
    if (!abandon()) return;
    setEditing(idea);
    setDraft({
      title: idea.title,
      details: idea.details,
      tags: idea.tags,
      done: idea.done,
    });
    setNotice("");
    setError("");
    document.getElementById("idea-title")?.focus();
    document.getElementById("idea-form")?.scrollIntoView({ block: "start" });
  }
  function remember(saved: ProjectIdea) {
    setIdeas((items) => [saved, ...items.filter((i) => i.id !== saved.id)]);
    setTags((items) =>
      [
        ...new Map([...items, ...saved.tags].map((t) => [t.id, t])).values(),
      ].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api(
        editing ? `/api/ideas/${editing.id}` : "/api/ideas",
        editing ? "PUT" : "POST",
        { ...draft, ...(editing ? { version: editing.version } : {}) },
      );
      remember(saved);
      reset();
      setNotice("Idea saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(idea: ProjectIdea) {
    setBusy(true);
    setError("");
    try {
      remember(
        await api(`/api/ideas/${idea.id}`, "PUT", {
          ...idea,
          done: !idea.done,
        }),
      );
      setNotice(idea.done ? "Idea reopened." : "Idea completed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(idea: ProjectIdea) {
    if (!window.confirm(`Delete “${idea.title}”? This cannot be undone.`))
      return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/ideas/${idea.id}`, "DELETE", { version: idea.version });
      setIdeas((items) => items.filter((i) => i.id !== idea.id));
      setNotice("Idea deleted.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (!abandon()) return;
    setBusy(true);
    try {
      await api("/api/auth/logout", "POST", {});
      leaving.current = true;
      window.location.href = "/login";
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const shown = ideas.filter(
    (i) =>
      (status === "all" || i.done === (status === "done")) &&
      (!tag || i.tags.some((t) => t.id === tag)),
  );
  return (
    <>
      {header &&
        createPortal(
          <button className="sign-out" disabled={busy} onClick={logout}>
            Sign out
          </button>,
          header,
        )}
      <nav className="workspace-tabs" aria-label="Workspace">
        <a href="/">Articles</a>
        <a href="/ideas" aria-current="page">
          Project ideas
        </a>
      </nav>
      <div className="workspace-heading">
        <div>
          <h1>Project ideas</h1>
          <p className="workspace-intro">
            A private list for things you want to build. These never appear on
            your public blog.
          </p>
        </div>
      </div>
      <div className="ideas-layout">
        <form id="idea-form" className="idea-form" onSubmit={save}>
          <h2>{editing ? "Edit idea" : "New idea"}</h2>
          <fieldset disabled={busy} className="idea-fields">
            <label htmlFor="idea-title">
              Project title
              <input
                id="idea-title"
                required
                maxLength={200}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="What would you like to build?"
              />
            </label>
            <label>
              Details (optional)
              <textarea
                rows={4}
                maxLength={20000}
                value={draft.details}
                onChange={(e) =>
                  setDraft({ ...draft, details: e.target.value })
                }
                placeholder="A few notes, links, or the next step…"
              />
            </label>
            <TagPicker
              key={pickerKey}
              selected={draft.tags}
              onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
              disabled={busy}
            />
            <div className="idea-actions">
              <button
                type="submit"
                className="primary"
                disabled={!draft.title.trim() || busy}
              >
                {busy ? "Saving…" : editing ? "Save idea" : "Add idea"}
              </button>
              {(editing || dirty) && (
                <button
                  type="button"
                  onClick={() => {
                    if (abandon()) reset();
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}{" "}
              <a href="/login" target="_blank" rel="noopener noreferrer">
                Sign in
              </a>
            </p>
          )}
          <p className="status" role="status">
            {notice ||
              (dirty
                ? "Unsaved changes · use the save button below your tags."
                : "")}
          </p>
        </form>
        <section className="ideas-list-panel" aria-label="Project ideas list">
          <div className="idea-filters">
            <label>
              Show
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="open">To do</option>
                <option value="done">Done</option>
                <option value="all">All ideas</option>
              </select>
            </label>
            <label>
              Filter ideas by tag
              <select value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">All tags</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy || loading}
              onClick={() => {
                if (abandon()) {
                  reset();
                  void load(true);
                }
              }}
            >
              Reload list
            </button>
          </div>
          <p className="status">
            {loading
              ? "Loading ideas…"
              : `${shown.length} ${shown.length === 1 ? "idea" : "ideas"}`}
          </p>
          {!loading && !shown.length && (
            <p className="ideas-empty">
              {ideas.length
                ? "No ideas match these filters."
                : "Start with a title. Add tags and details whenever you like."}
            </p>
          )}
          <ul className="ideas-list">
            {shown.map((idea) => (
              <li key={idea.id} className={idea.done ? "idea-done" : ""}>
                <input
                  type="checkbox"
                  checked={idea.done}
                  aria-label={`Mark ${idea.title} ${idea.done ? "to do" : "done"}`}
                  disabled={busy || editing?.id === idea.id}
                  onChange={() => void toggle(idea)}
                />
                <div className="idea-content">
                  <h2>{idea.title}</h2>
                  <div className="card-tags">
                    {idea.tags.map((t) => (
                      <span key={t.id} style={tagStyle(t)}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                  {idea.details && (
                    <details>
                      <summary>Details</summary>
                      <p>{idea.details}</p>
                    </details>
                  )}
                  <div className="idea-actions">
                    <button disabled={busy} onClick={() => edit(idea)}>
                      Edit
                    </button>
                    <button
                      disabled={busy || editing?.id === idea.id}
                      onClick={() => void remove(idea)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
