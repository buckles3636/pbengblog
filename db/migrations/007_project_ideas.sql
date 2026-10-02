CREATE TABLE project_ideas (
  id uuid PRIMARY KEY,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  details text NOT NULL DEFAULT '' CHECK (length(details) <= 20000),
  done boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE idea_tags (
  idea_id uuid NOT NULL REFERENCES project_ideas(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (idea_id, tag_id)
);
CREATE INDEX idea_tags_tag_idx ON idea_tags(tag_id, idea_id);
INSERT INTO tags(id,name) VALUES
  ('20000000-0000-4000-8000-000000000001','Server'),
  ('20000000-0000-4000-8000-000000000002','Hardware'),
  ('20000000-0000-4000-8000-000000000003','Business')
ON CONFLICT (lower(name)) DO NOTHING;
