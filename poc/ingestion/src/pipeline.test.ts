import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Pipeline } from './pipeline.js';
import type { Store } from './store.js';
import { schemaDDL } from './schema.js';

const isBun = typeof Bun !== 'undefined';
const openStore: (kind: 'duckdb' | 'sqlite', path: string) => Promise<Store> = isBun
  ? async (_, path) => (await import('./bun-store.js')).BunSQLiteStore.open(path)
  : (await import('./store.js')).SQLStore.open;
for (const kind of (isBun ? ['sqlite'] : ['duckdb', 'sqlite']) as ('duckdb' | 'sqlite')[]) {
  test(`${isBun ? 'bun-' : ''}${kind}: persisted JSON, historical identity linking and late event semantics`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'quack-ingestion-test-'));
    let db = await openStore(kind, join(dir, 'events.db'));
    const schemas = await openStore('sqlite', join(dir, 'schemas.db'));
    try {
      await db.initEvents(resolve('../legacy-go-backend/database/analyticsdb/analyticsmigrations/03_identity_rewrite.up.sql'));
      await schemas.exec(schemaDDL);
      const p = new Pipeline(db, schemas);
      await p.ingest(JSON.stringify([{ eventType: 'view', sessionId: 's', timestamp: '2026-01-01T00:00:00.123Z', properties: { path: '/docs' }, personProperties: { plan: 'free', country: 'DE' } }]));
      assert.equal(Number((await db.rows('SELECT count(*) AS n FROM persons'))[0].n), 0);
      await p.ingest(JSON.stringify([{ eventType: 'login', sessionId: 's', personId: 'p', timestamp: '2026-01-01T00:01:00.123Z', properties: { path: '/login' }, personProperties: { plan: 'paid' } }]));
      await p.ingest(JSON.stringify([{ eventType: 'view', sessionId: 's', timestamp: '2026-01-01T00:00:30.123Z', properties: { path: '/late' }, personProperties: { plan: 'free' } }]));
      const person = (await db.rows(`SELECT properties,property_timestamps,${db.millis('first_seen')} AS first_seen FROM persons WHERE id='p'`))[0];
      assert.deepEqual(JSON.parse(String(person.properties)), { plan: 'paid', country: 'DE' });
      assert.equal(Date.parse(JSON.parse(String(person.property_timestamps)).plan), Date.parse('2026-01-01T00:01:00.123Z'));
      assert.equal(Number(person.first_seen), Date.parse('2026-01-01T00:00:00.123Z'));
      const session = (await db.rows(`SELECT person_id,${db.millis('last_seen')} AS last_seen FROM sessions WHERE id='s'`))[0];
      assert.equal(session.person_id, 'p');
      assert.equal(Number(session.last_seen), Date.parse('2026-01-01T00:01:00.123Z'));
      db.close();
      db = await openStore(kind, join(dir, 'events.db'));
      const rows = await db.rows('SELECT json_type(properties) AS type FROM events');
      assert.equal(rows.length, 3);
      assert(rows.every(row => String(row.type).toLowerCase() === 'object'));
      const resolved = (await db.rows("SELECT count(*) AS n FROM events e LEFT JOIN sessions s ON s.id=e.session_id WHERE coalesce(e.person_id,s.person_id)='p'"))[0];
      assert.equal(Number(resolved.n), 3);
    } finally { db.close(); schemas.close(); rmSync(dir, { recursive: true }); }
  });
}
