CREATE TABLE publication_jobs (
  id uuid PRIMARY KEY,
  request_id uuid UNIQUE NOT NULL,
  post_id uuid NOT NULL REFERENCES posts(id),
  post_version integer NOT NULL CHECK (post_version > 0),
  title text NOT NULL,
  articles jsonb NOT NULL CHECK (jsonb_typeof(articles) = 'array' AND jsonb_array_length(articles) > 0),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','building','deploying','succeeded','failed','needs_review')),
  message text NOT NULL DEFAULT 'Waiting for publisher',
  release_id text,
  deployment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE UNIQUE INDEX publication_one_active ON publication_jobs ((true))
  WHERE state IN ('queued','building','deploying','needs_review');
CREATE INDEX publication_recent ON publication_jobs(created_at DESC);
CREATE TABLE publisher_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  heartbeat_at timestamptz NOT NULL DEFAULT now()
);
