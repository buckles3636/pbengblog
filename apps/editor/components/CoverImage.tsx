"use client";
import { useRef, useState } from "react";
import { safeUrl } from "../../../shared/content";
export default function CoverImage({
  value,
  onChange,
  disabled,
  onUploading,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled: boolean;
  onUploading: (value: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!file.size || file.size > 12 * 1024 * 1024) {
      setError("Choose an image smaller than 12 MB.");
      return;
    }
    setUploading(true);
    onUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/uploads", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(120000),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || "Image upload failed. Please try again.");
      onChange(data.url);
    } catch (error) {
      setError(
        (error as Error).name === "TimeoutError"
          ? "Upload timed out. Please try again."
          : (error as Error).message,
      );
    } finally {
      setUploading(false);
      onUploading(false);
    }
  }
  return (
    <section className="cover-editor" aria-label="Cover image">
      <div className="cover-row">
        <div className="cover-thumbnail">
          {safeUrl(value, true) ? (
            <img src={safeUrl(value, true)} alt="Article cover preview" />
          ) : (
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="26" height="22" rx="4" />
              <circle cx="11" cy="12" r="2" />
              <path d="m5 24 8-8 5 5 4-4 6 7" />
            </svg>
          )}
        </div>
        <div className="cover-copy">
          <h2>Cover image</h2>
          <p>Give your article a face. PNG, JPG, WebP or GIF, up to 12 MB.</p>
          <div className="cover-actions">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              aria-label="Choose cover image"
              hidden
              disabled={disabled || uploading}
              onChange={(event) => {
                void upload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => input.current?.click()}
            >
              {uploading
                ? "Uploading…"
                : value
                  ? "Replace cover"
                  : "Upload cover"}
            </button>
            {value && (
              <button
                type="button"
                className="quiet-button"
                disabled={disabled || uploading}
                onClick={() => {
                  setError("");
                  onChange("");
                }}
              >
                Remove cover
              </button>
            )}
          </div>
        </div>
      </div>
      <details className="cover-url">
        <summary>Use an image URL</summary>
        <label>
          Cover image URL
          <input
            value={value}
            disabled={disabled || uploading}
            placeholder="https://… or /media/…"
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
