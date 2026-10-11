-- Archived events exist only in S3; refuse to forget them.
CREATE TEMP TABLE archive_guard(archived INTEGER CHECK(archived=0));
INSERT INTO archive_guard SELECT count(*) FROM archived_partitions;
DROP TABLE archive_guard;
DROP TABLE archived_event_types;
DROP TABLE archived_partitions;
