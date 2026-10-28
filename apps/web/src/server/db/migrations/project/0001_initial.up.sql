CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO settings VALUES('cors_origins', '[]'), ('revision', '0');
CREATE TABLE events(
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  session_id TEXT,
  person_id TEXT,
  anonymous_id TEXT,
  user_id TEXT,
  properties TEXT NOT NULL CHECK(json_valid(properties)),
  person_properties TEXT NOT NULL CHECK(json_valid(person_properties)),
  fingerprint TEXT NOT NULL
);
CREATE INDEX events_timestamp ON events(timestamp, id);
CREATE INDEX events_session ON events(session_id);
CREATE INDEX events_anonymous ON events(anonymous_id);
CREATE TABLE persons(
  id TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  properties TEXT NOT NULL,
  property_timestamps TEXT NOT NULL
);
CREATE TABLE sessions(
  id TEXT PRIMARY KEY,
  person_id TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE identity_links(anonymous_id TEXT PRIMARY KEY, user_id TEXT NOT NULL);
CREATE TABLE identity_operations(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL);
CREATE TABLE schemas(
  id INTEGER PRIMARY KEY,
  event_type TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  UNIQUE(event_type, name)
);
CREATE TABLE schema_values(
  property_id INTEGER NOT NULL REFERENCES schemas(id),
  value TEXT NOT NULL,
  UNIQUE(property_id, value)
);
CREATE TABLE insights(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  json TEXT NOT NULL CHECK(json_valid(json))
);
CREATE TABLE dashboards(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  json TEXT NOT NULL CHECK(json_valid(json))
);
CREATE TABLE dashboard_insights(
  dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  insight_id INTEGER NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position >= 0),
  layout TEXT CHECK(layout IS NULL OR json_valid(layout)),
  PRIMARY KEY(dashboard_id, insight_id),
  UNIQUE(dashboard_id, position)
);
CREATE INDEX dashboard_insights_insight ON dashboard_insights(insight_id);
CREATE TABLE requests(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL);
CREATE TABLE catalog(name TEXT PRIMARY KEY, json TEXT NOT NULL CHECK(json_valid(json)));
CREATE TABLE dirty_partitions(partition TEXT PRIMARY KEY, revision INTEGER NOT NULL);
CREATE TABLE export_manifest(partition TEXT PRIMARY KEY, json TEXT NOT NULL CHECK(json_valid(json)));
CREATE TABLE jobs(
  id INTEGER PRIMARY KEY CHECK(id = 1),
  revision INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
-- Complete months verified in S3 leave the events table a week after they end.
-- Their bounds and event types stay here; everything else lives only in S3.
CREATE TABLE archived_partitions(
  partition TEXT PRIMARY KEY,
  first_timestamp INTEGER NOT NULL,
  last_timestamp INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE archived_event_types(event_type TEXT PRIMARY KEY) WITHOUT ROWID;
