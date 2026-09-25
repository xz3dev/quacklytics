export const schemaDDL = `
CREATE TABLE event_schemas(id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT);
CREATE INDEX idx_event_schemas_event_type ON event_schemas(event_type);
CREATE TABLE event_schema_properties(id INTEGER PRIMARY KEY AUTOINCREMENT, event_schema_id INTEGER REFERENCES event_schemas(id), key TEXT, type TEXT);
CREATE INDEX idx_properties_schema ON event_schema_properties(event_schema_id);
CREATE INDEX idx_properties_key ON event_schema_properties(key);
CREATE INDEX idx_properties_type ON event_schema_properties(type);
CREATE TABLE event_schema_property_values(id INTEGER PRIMARY KEY AUTOINCREMENT, event_schema_property_id INTEGER REFERENCES event_schema_properties(id), value TEXT);
CREATE UNIQUE INDEX uniqueVal ON event_schema_property_values(event_schema_property_id,value);
CREATE INDEX idx_values_property ON event_schema_property_values(event_schema_property_id);
`;

export const sqliteEventDDL = `
      CREATE TABLE events(id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, event_type TEXT NOT NULL,
        session_id TEXT, person_id TEXT, properties TEXT NOT NULL, person_properties TEXT NOT NULL);
      CREATE INDEX events_timestamp ON events(timestamp);
      CREATE INDEX events_session ON events(session_id);
      CREATE TABLE persons(id TEXT PRIMARY KEY, first_seen TEXT NOT NULL, properties TEXT NOT NULL, property_timestamps TEXT NOT NULL);
      CREATE TABLE sessions(id TEXT PRIMARY KEY, person_id TEXT REFERENCES persons(id), first_seen TEXT NOT NULL, last_seen TEXT NOT NULL);
    `;
