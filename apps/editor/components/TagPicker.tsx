"use client";
import { tagStyle } from "../../../shared/tag-colors";
import { useEffect, useState } from "react";
import type { Tag } from "../../../shared/content";
async function request(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Unable to update tags");
  return data;
}
export default function TagPicker({
  selected,
  onChange,
  disabled = false,
}: {
  selected: Tag[];
  onChange: (tags: Tag[]) => void;
  disabled?: boolean;
}) {
  const [tags, setTags] = useState<Tag[]>([]),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [renameId, setRenameId] = useState(""),
    [rename, setRename] = useState("");
  async function load() {
    try {
      setTags(await request("/api/tags"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const selectedIds = new Set(selected.map((t) => t.id));
  async function create() {
    setBusy(true);
    try {
      const tag: Tag = await request("/api/tags", "POST", { name });
      await load();
      if (!selectedIds.has(tag.id)) onChange([...selected, tag]);
      setName("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update() {
    const old = tags.find((t) => t.id === renameId);
    if (!old) return;
    setBusy(true);
    try {
      const tag: Tag = await request(`/api/tags/${old.id}`, "PUT", {
        name: rename,
        previousName: old.name,
      });
      await load();
      onChange(selected.map((t) => (t.id === tag.id ? tag : t)));
      setRenameId("");
      setRename("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset className="tag-picker" disabled={busy || disabled}>
      <legend>Tags</legend>
      <div className="tag-options">
        {tags.map((tag) => (
          <label key={tag.id} style={tagStyle(tag)}>
            <input
              type="checkbox"
              checked={selectedIds.has(tag.id)}
              disabled={!selectedIds.has(tag.id) && selected.length >= 30}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, tag]
                    : selected.filter((t) => t.id !== tag.id),
                )
              }
            />
            {tag.name}
          </label>
        ))}
      </div>
      {!tags.length && !error && (
        <p className="status">Create your first tag below.</p>
      )}
      <div className="tag-controls">
        <label>
          New tag
          <input
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (name.trim()) void create();
              }
            }}
          />
        </label>
        <button
          type="button"
          disabled={!name.trim() || selected.length >= 30}
          onClick={create}
        >
          Create & add
        </button>
      </div>
      <details>
        <summary>Manage tags</summary>
        <p className="status">
          Rename a tag across drafts. Published articles keep their saved tags
          until you publish them again.
        </p>
        <div className="tag-controls">
          <label>
            Tag to rename
            <select
              value={renameId}
              onChange={(e) => {
                setRenameId(e.target.value);
                setRename(
                  tags.find((t) => t.id === e.target.value)?.name ?? "",
                );
              }}
            >
              <option value="">Choose a tag</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            New name
            <input
              value={rename}
              maxLength={60}
              onChange={(e) => setRename(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!renameId || !rename.trim()}
            onClick={update}
          >
            Rename tag
          </button>
          <button type="button" onClick={load}>
            Reload tags
          </button>
        </div>
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
