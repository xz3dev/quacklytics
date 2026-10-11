DROP TABLE identity_operations;
DROP TABLE identity_links;
DROP INDEX events_anonymous;
ALTER TABLE events DROP COLUMN anonymous_id;
ALTER TABLE events DROP COLUMN user_id;
