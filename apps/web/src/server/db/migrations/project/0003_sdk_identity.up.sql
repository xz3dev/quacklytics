ALTER TABLE events ADD COLUMN anonymous_id TEXT;
ALTER TABLE events ADD COLUMN user_id TEXT;
CREATE INDEX events_anonymous ON events(anonymous_id);
CREATE TABLE identity_links(anonymous_id TEXT PRIMARY KEY,user_id TEXT NOT NULL);
CREATE TABLE identity_operations(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL);
