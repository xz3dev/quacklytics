
 CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 INSERT INTO settings VALUES('cors_origins','[]'),('revision','0');
 CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,timestamp INTEGER NOT NULL,event_type TEXT NOT NULL,session_id TEXT,person_id TEXT,properties TEXT NOT NULL CHECK(json_valid(properties)),person_properties TEXT NOT NULL CHECK(json_valid(person_properties)),fingerprint TEXT NOT NULL);
 CREATE INDEX events_timestamp ON events(timestamp,id); CREATE INDEX events_session ON events(session_id);
 CREATE TABLE persons(id TEXT PRIMARY KEY,first_seen INTEGER NOT NULL,properties TEXT NOT NULL,property_timestamps TEXT NOT NULL);
 CREATE TABLE sessions(id TEXT PRIMARY KEY,person_id TEXT,first_seen INTEGER NOT NULL,last_seen INTEGER NOT NULL);
 CREATE TABLE schemas(id INTEGER PRIMARY KEY,event_type TEXT NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL,UNIQUE(event_type,name));
 CREATE TABLE schema_values(property_id INTEGER NOT NULL REFERENCES schemas(id),value TEXT NOT NULL,UNIQUE(property_id,value));
 CREATE TABLE insights(id INTEGER PRIMARY KEY AUTOINCREMENT,json TEXT NOT NULL CHECK(json_valid(json)));
 CREATE TABLE dashboards(id INTEGER PRIMARY KEY AUTOINCREMENT,json TEXT NOT NULL CHECK(json_valid(json)));
 CREATE TABLE requests(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,result TEXT NOT NULL);
 CREATE TABLE catalog(name TEXT PRIMARY KEY,json TEXT NOT NULL CHECK(json_valid(json)));
 CREATE TABLE dirty_partitions(partition TEXT PRIMARY KEY,revision INTEGER NOT NULL);
 CREATE TABLE export_manifest(partition TEXT PRIMARY KEY,json TEXT NOT NULL CHECK(json_valid(json)));
 CREATE TABLE jobs(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,error TEXT);
 