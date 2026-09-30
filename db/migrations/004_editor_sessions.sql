CREATE TABLE editor_sessions (
  token_hash text PRIMARY KEY,
  credential_version text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX editor_sessions_expiry ON editor_sessions(expires_at);
CREATE TABLE editor_login_limits (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  resets_at timestamptz NOT NULL
);
