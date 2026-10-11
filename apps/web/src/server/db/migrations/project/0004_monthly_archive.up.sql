-- Complete months verified in S3 leave the events table a week after they end.
-- Their bounds and event types stay here; everything else lives only in S3.
CREATE TABLE archived_partitions(partition TEXT PRIMARY KEY,first_timestamp INTEGER NOT NULL,last_timestamp INTEGER NOT NULL) WITHOUT ROWID;
CREATE TABLE archived_event_types(event_type TEXT PRIMARY KEY) WITHOUT ROWID;
