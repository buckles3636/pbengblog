ALTER TABLE posts ADD COLUMN entry_date text NOT NULL DEFAULT '' CHECK (entry_date = '' OR entry_date ~ '^[1-9][0-9]{3}(-[0-9]{2}(-[0-9]{2})?)?$');
