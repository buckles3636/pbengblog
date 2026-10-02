"use client";
import { useEffect, useState } from "react";
import type { Post } from "../../../shared/content";
export type Revision = { version: number; created_at: string; snapshot: Post };
export default function HistoryPanel({
  postId,
  version,
  busy,
  onRestore,
  onClose,
}: {
  postId: string;
  version: number;
  busy: boolean;
  onRestore: (revision: Revision) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/posts/${postId}/revisions`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Unable to load history");
        return data;
      })
      .then(setItems)
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [postId, version]);
  return (
    <section
      id="revision-history"
      className="history-panel"
      aria-label="Revision history"
    >
      <div className="panel-heading">
        <div>
          <h2>Revision history</h2>
          <p>
            Restore a saved version as a new draft. Your existing history is
            kept.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close history">
          Close
        </button>
      </div>
      {loading && <p aria-live="polite">Loading saved revisions…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && !items.length && <p>No saved revisions yet.</p>}
      {!loading && !error && (
        <ol className="history-items">
          {items.map((item) => (
            <li key={item.version}>
              <div>
                <strong>{item.snapshot.title || "Untitled article"}</strong>
                <span>
                  Revision {item.version} ·{" "}
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  {item.version === version && " · Current"}
                </span>
              </div>
              <button
                disabled={busy || item.version === version}
                onClick={() => void onRestore(item)}
              >
                Restore r{item.version}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
