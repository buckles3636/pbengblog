CREATE UNIQUE INDEX posts_published_slug_unique ON posts ((published->>'slug')) WHERE published IS NOT NULL;
ALTER TABLE posts ADD CONSTRAINT posts_slug_not_reserved CHECK (slug NOT IN ('api','media','_next','robots','sitemap','admin'));
ALTER TABLE posts ADD CONSTRAINT published_matches_post CHECK (published IS NULL OR (published->>'id'=id::text AND published->>'slug'=slug AND jsonb_typeof(published->'blocks')='array'));
CREATE TABLE media (
  id uuid PRIMARY KEY,
  filename text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  bytes bigint NOT NULL CHECK (bytes > 0),
  sha256 text NOT NULL CHECK (length(sha256)=64),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE imports (
  source_id uuid PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id),
  source_url text NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]',
  imported_at timestamptz NOT NULL DEFAULT now()
);
