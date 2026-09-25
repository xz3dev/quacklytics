import { strict as assert } from 'node:assert';
import { sqliteConfig } from './sqlite-config.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Pipeline } from './pipeline.js';
import type { Store } from './store.js';
import { schemaDDL } from './schema.js';
import { serve } from './http.js';

const dir = process.env.POC_DIR!;
const kind = process.env.POC_BACKEND as 'duckdb' | 'sqlite';
const mode = process.env.POC_MODE ?? 'pipeline';
const isBun = process.env.POC_IMPLEMENTATION === 'bun-sqlite';
const openStore: (kind: 'duckdb' | 'sqlite', path: string) => Promise<Store> = isBun
  ? async (_, path) => (await import('./bun-store.js')).BunSQLiteStore.open(path)
  : (await import('./store.js')).SQLStore.open;
const fixture = JSON.parse(readFileSync(process.env.POC_FIXTURE!, 'utf8')) as { warmup: string[]; batches: string[] };
const dataPath = join(dir, `events.${kind}`), schemaPath = join(dir, 'app.sqlite');
let db = await openStore(kind, dataPath);
let schemas = await openStore('sqlite', schemaPath);
await db.initEvents(process.env.POC_SCHEMA!);
await schemas.exec(schemaDDL);
const settings: Record<string, Record<string, unknown>> = {};
for (const [name, store] of [['events', db], ['schemas', schemas]] as const) {
  if (store.kind !== 'sqlite') continue;
  settings[name] = {};
  for (const pragma of ['journal_mode', 'synchronous', 'wal_autocheckpoint', 'page_size', 'fullfsync', 'checkpoint_fullfsync', 'foreign_keys', 'cache_size', 'mmap_size', 'temp_store', 'secure_delete', 'locking_mode', 'automatic_index']) {
    settings[name][pragma] = Object.values((await store.rows(`PRAGMA ${pragma}`))[0])[0];
  }
  assert.equal(settings[name].journal_mode, sqliteConfig().journal.toLowerCase());
  assert.equal(settings[name].synchronous, sqliteConfig().synchronous === 'FULL' ? 2 : 1);
  assert.equal(settings[name].wal_autocheckpoint, 1000);
  assert.equal(settings[name].cache_size, -16000);
  assert.equal(settings[name].mmap_size, 0);
  assert.equal(settings[name].temp_store, 1);
  assert.equal(settings[name].secure_delete, 0);
  assert.equal(settings[name].fullfsync, 0);
  assert.equal(settings[name].checkpoint_fullfsync, 1);
}
const pipeline = new Pipeline(db, schemas);
const latencies: number[] = [];
let count = 0;
let elapsed: number;
if (process.env.POC_HTTP === '1') {
  const server = await serve(async (raw, warmup) => {
    const start = performance.now();
    const n = await pipeline.ingest(raw, mode);
    if (!warmup) { count += n; latencies.push(performance.now() - start); }
    return n;
  });
  writeFileSync(join(dir, 'ready.json'), JSON.stringify({ url: server.url }));
  await server.done;
  elapsed = latencies.reduce((a, b) => a + b, 0) / 1000;
} else {
  for (const raw of fixture.warmup) await pipeline.ingest(raw, mode);
  const start = performance.now();
  for (const raw of fixture.batches) {
    const batchStart = performance.now();
    count += await pipeline.ingest(raw, mode);
    latencies.push(performance.now() - batchStart);
  }
  elapsed = (performance.now() - start) / 1000;
}
const duckVersion = kind === 'duckdb' ? (await db.rows('SELECT version() AS v'))[0].v : null;
const sqliteVersion = (await schemas.rows('SELECT sqlite_version() AS v'))[0].v;
// Report remaining WAL checkpoint work separately, as well as an inclusive rate.
let checkpointMs = 0;
if (sqliteConfig().journal === 'WAL') {
  const start = performance.now();
  for (const store of [db, schemas]) if (store.kind === 'sqlite') {
    const row = (await store.rows('PRAGMA wal_checkpoint(TRUNCATE)'))[0];
    assert.equal(Number(Object.values(row)[0]), 0, 'Checkpoint blocked');
  }
  checkpointMs = performance.now() - start;
}
// Verify persisted state after closing and reopening, not just buffered counts.
db.close(); schemas.close();
db = await openStore(kind, dataPath); schemas = await openStore('sqlite', schemaPath);
const values = async (store: Store, query: string) => (await store.rows(query)).map(Object.values);
const snapshot = {
  events: await values(db, `SELECT ${db.millis('timestamp')},event_type,session_id,person_id,CAST(properties AS VARCHAR),CAST(person_properties AS VARCHAR) FROM events`),
  persons: await values(db, `SELECT id,${db.millis('first_seen')},CAST(properties AS VARCHAR),CAST(property_timestamps AS VARCHAR) FROM persons`),
  sessions: await values(db, `SELECT id,person_id,${db.millis('first_seen')},${db.millis('last_seen')} FROM sessions`),
  schemas: await values(schemas, 'SELECT s.event_type,p.key,p.type,v.value FROM event_schemas s JOIN event_schema_properties p ON p.event_schema_id=s.id JOIN event_schema_property_values v ON v.event_schema_property_id=p.id'),
  distinctIds: (await db.rows('SELECT count(distinct id) AS n FROM events'))[0].n,
  jsonObjectEvents: (await db.rows(`SELECT count(*) AS n FROM events WHERE lower(json_type(properties))='object' AND lower(json_type(person_properties))='object'`))[0].n,
};
const serialize = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? Number(v) : v);
writeFileSync(join(dir, 'snapshot.json'), serialize(snapshot));
latencies.sort((a, b) => a - b);
const percentile = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];
const result = {
  implementation: isBun ? 'bun-sqlite' : `ts-${kind}`, mode, events: count, seconds: elapsed, eventsPerSecond: count / elapsed,
  batchP50Ms: percentile(.5), batchP95Ms: percentile(.95), batchP99Ms: percentile(.99),
  duckdbStatementCache: kind === 'duckdb' && process.env.POC_DUCKDB_CACHE !== 'off',
  sqliteProfile: sqliteConfig().profile, sqliteSettings: settings, checkpointMs,
  eventsPerSecondIncludingCheckpoint: count / (elapsed + checkpointMs / 1000),
  runtime: isBun ? `bun-${Bun.version}` : process.version, duckdb: duckVersion, sqlite: sqliteVersion,
};
writeFileSync(join(dir, 'result.json'), serialize(result));
console.log(serialize(result));
db.close(); schemas.close();
