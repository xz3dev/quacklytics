// Loaded automatically by MCP clients; keep it to what every session needs.
export const instructions = `Quacklytics product analytics for every project you can read, one per tracked site or app. Use it to answer questions about how people use the product (traffic, signups, conversion, retention, feature usage), to explain or reproduce the team's saved charts, and to dig deeper than the dashboards go. You query the raw events yourself with DuckDB.

1. Call list_projects and pick the project the question is about; ask the user when that is unclear. Every other tool except get_query_guide takes its id as \`project\`.
2. Call get_dataset. Run its setupSql in DuckDB (CLI, Python or Node); it defines the view \`events\` over signed HTTPS Parquet URLs. No credentials or extensions to configure: DuckDB autoloads httpfs.
3. Columns: id VARCHAR, timestamp TIMESTAMP (UTC), event_type VARCHAR, session_id VARCHAR, person_id VARCHAR, properties JSON.
4. Read properties with JSON operators, e.g. properties->>'$.plan' (text) or (properties->>'$.amount')::DOUBLE. Call get_schema for event types and property names.
5. setupSql covers every event exactly once. Never combine it with data from another get_dataset call, and never add your own "recent events" on top. A snapshot is reused for up to 10 minutes (see capturedAt), so the newest events can be a few minutes late. URLs expire at expiresAt: for newer data or when reads fail with 403, call get_dataset again and rerun its setupSql.
6. To learn which metrics matter to the team, browse list_dashboards and list_insights, and open a chart with get_insight; follow its definition when your numbers should match the team's. Call get_query_guide for example queries and help with failing or slow queries.`;

export const queryGuide = `# Querying Quacklytics events with DuckDB

## Setup
setupSql is CREATE OR REPLACE VIEW events AS SELECT * FROM read_parquet([<signed HTTPS URLs>]); run it in a database file to keep the view for later queries:
DuckDB CLI:
  duckdb analytics.duckdb "<setupSql>"
  duckdb analytics.duckdb "SELECT count(*) FROM events"
Python:
  import duckdb; con = duckdb.connect("analytics.duckdb"); con.execute(setup_sql)
Node (@duckdb/node-api):
  const conn = await (await DuckDBInstance.create("analytics.duckdb")).connect(); await conn.run(setupSql);
eventCount is the number of rows in events; use it to check the setup.
Every project's setupSql defines the same view name, so keep one database file per project (e.g. <project id>.duckdb) when working with several.

## Freshness
- One get_dataset call is one consistent snapshot. Never mix its data with data from another call, including tables copied from an earlier view, and never add events yourself: that counts events twice or misses them.
- get_dataset reuses a snapshot for up to 10 minutes; capturedAt says when it was taken. Calling again sooner returns the same data with fresh URLs.
- URLs expire at expiresAt. For newer data or after a 403, call get_dataset again and run its setupSql; CREATE OR REPLACE swaps the view.

## Large datasets
Every query on the view reads the files over HTTPS. For repeated or heavy queries, copy the snapshot once and query the copy:
  CREATE OR REPLACE TABLE ev AS SELECT * FROM events;
Rebuild it from the view after the next get_dataset call. COPY events TO 'events.parquet' (FORMAT PARQUET) writes one local file for other tools.

## Columns
- id: event UUID, unique across the dataset.
- timestamp: TIMESTAMP in UTC, millisecond precision. Use date_trunc('day', timestamp), timestamp >= TIMESTAMP '2026-09-01'. DuckDB's now() and current_date follow the local time zone; compare against now() AT TIME ZONE 'UTC'.
- event_type: e.g. '$pageview', '$click' or a custom name.
- session_id: may be NULL.
- person_id: 'user:<id>' for identified users, 'anonymous:<id>' for anonymous visitors, NULL if unknown. Anonymous activity that was later identified already carries the user: id.
- properties: JSON object of event properties. Events from the browser SDK also carry "$context" (page.url, page.path, page.title, page.referrer, deviceType, browser, os) and, when GeoIP is enabled, '$country' (ISO alpha-2).

## JSON properties
  properties->>'$.plan'                       -- VARCHAR
  properties->>'$."$context".page.path'       -- keys starting with $ need quotes
  (properties->>'$.price')::DOUBLE            -- number
  properties->'$.items'                       -- nested JSON
  json_keys(properties)                       -- discover keys
  SELECT DISTINCT unnest(json_keys(properties)) FROM events WHERE event_type = '$pageview';

## Examples
Daily active people, last 30 days:
  SELECT date_trunc('day', timestamp) AS day, count(DISTINCT person_id) AS people
  FROM events WHERE timestamp >= now() AT TIME ZONE 'UTC' - INTERVAL 30 DAY
  GROUP BY ALL ORDER BY day;

Top pages:
  SELECT properties->>'$."$context".page.path' AS path, count(*) AS views
  FROM events WHERE event_type = '$pageview' GROUP BY ALL ORDER BY views DESC LIMIT 20;

Two-step funnel within 1 day per person:
  WITH a AS (SELECT person_id, min(timestamp) t FROM events WHERE event_type = 'signup_started' AND person_id IS NOT NULL GROUP BY ALL),
       b AS (SELECT e.person_id, min(e.timestamp) t FROM events e JOIN a USING (person_id)
             WHERE e.event_type = 'signup_completed' AND e.timestamp BETWEEN a.t AND a.t + INTERVAL 1 DAY GROUP BY ALL)
  SELECT (SELECT count(*) FROM a) AS started, (SELECT count(*) FROM b) AS completed;

Weekly retention cohorts:
  WITH firsts AS (SELECT person_id, date_trunc('week', min(timestamp)) cohort FROM events GROUP BY ALL),
       activity AS (SELECT DISTINCT person_id, date_trunc('week', timestamp) week FROM events)
  SELECT cohort, date_diff('week', cohort, week) AS week_index, count(*) AS people
  FROM firsts JOIN activity USING (person_id) GROUP BY ALL ORDER BY ALL;

## Saved insights
get_insight returns the structured definition the web app renders (Trend, Value, Funnel, Breakdown, Retention, Path, Map). Use its event types, filters, aggregations and time range as the specification when reproducing a number in SQL.`;
