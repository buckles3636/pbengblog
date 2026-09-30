CREATE TABLE tags (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60 AND name = btrim(name)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tags_name_unique ON tags (lower(name));
CREATE TABLE post_tags (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX post_tags_tag_idx ON post_tags(tag_id, post_id);
