"use client";
import { useEffect, useRef, useState } from "react";
import {
  publicationActive,
  type PublicationStatus,
} from "../../../shared/publication";
export default function PublicationNotice({
  publication,
  error,
}: {
  publication: PublicationStatus | null;
  error: string;
}) {
  const observed = useRef(new Set<string>());
  const [completed, setCompleted] = useState("");
  const [dismissed, setDismissed] = useState("");
  const job = publication?.job;
  const active = publicationActive(job || null);
  useEffect(() => {
    if (!job) return;
    if (active) {
      observed.current.add(job.id);
      return;
    }
    if (job.state === "succeeded" && observed.current.has(job.id)) {
      setCompleted(job.id);
      const timer = setTimeout(() => {
        setDismissed(job.id);
        setCompleted("");
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [job?.id, job?.state, active]);
  if (!publication?.enabled) return null;
  const serviceError =
    error ||
    (!publication.available
      ? "Publishing is temporarily offline. You can keep writing."
      : "");
  const showJob =
    job &&
    (active ||
      (dismissed !== job.id &&
        (job.state === "failed" || completed === job.id)));
  if (!serviceError && !showJob) return null;
  return (
    <section
      className={`publication-status publication-${job?.state || "idle"}`}
      aria-label="Website publishing"
      aria-live="polite"
    >
      <div>
        <strong>{serviceError || job?.message}</strong>
        {showJob && <span>{job.title}</span>}
      </div>
      <div className="notice-actions">
        {job?.state === "succeeded" && publication.siteUrl && (
          <a
            href={publication.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View website ↗
          </a>
        )}
        {!active && !serviceError && job && (
          <button
            type="button"
            aria-label="Dismiss publishing notification"
            onClick={() => setDismissed(job.id)}
          >
            Dismiss
          </button>
        )}
      </div>
    </section>
  );
}
