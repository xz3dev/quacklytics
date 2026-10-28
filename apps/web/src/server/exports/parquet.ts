import {
  type DuckDBAppender,
  type DuckDBConnection,
  timestampValue,
} from "@duckdb/node-api";
import { z } from "zod";

/** Quotes text, such as a file path or URL, as a DuckDB string literal. */
export const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;

// Every published Parquet file, monthly or live, has this layout, so agents and
// browsers can read any combination of them as one table.
export const createEventsTable = (conn: DuckDBConnection) =>
  conn.run(
    "CREATE TABLE events(id VARCHAR,timestamp TIMESTAMP,event_type VARCHAR,session_id VARCHAR,person_id VARCHAR,properties JSON)",
  );

const eventRow = z.object({
  id: z.string(),
  timestamp: z.number(),
  event_type: z.string(),
  session_id: z.string().nullable(),
  person_id: z.string().nullable(),
  // The stored JSON text is published unchanged; parsing it could round numbers.
  properties: z.string(),
});

/** Appends one row read with eventSelect. */
export function appendEvent(appender: DuckDBAppender, raw: unknown) {
  const row = eventRow.parse(raw);
  appender.appendVarchar(row.id);
  appender.appendTimestamp(timestampValue(BigInt(row.timestamp) * 1000n));
  appender.appendVarchar(row.event_type);
  row.session_id === null
    ? appender.appendNull()
    : appender.appendVarchar(row.session_id);
  row.person_id === null
    ? appender.appendNull()
    : appender.appendVarchar(row.person_id);
  appender.appendVarchar(row.properties);
  appender.endRow();
}
