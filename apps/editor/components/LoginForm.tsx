"use client";
import { useState, type FormEvent } from "react";
export default function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to sign in");
      window.location.assign("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="login-form">
      <label>
        Username
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={256}
          autoFocus
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1024}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
