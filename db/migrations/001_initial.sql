CREATE TABLE posts (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,159}$'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  summary text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Projects',
  cover text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL CHECK (jsonb_typeof(blocks) = 'array'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  published jsonb CHECK (published IS NULL OR jsonb_typeof(published) = 'object'),
  notion_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, version)
);
CREATE INDEX posts_updated_at_idx ON posts(updated_at DESC);
CREATE INDEX revisions_post_created_idx ON revisions(post_id, created_at DESC);
