import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { SQLStore, schemaDDL } from './store.js';
import { Pipeline } from './pipeline.js';
import { serve } from './http.js';

// Fresh isolated directory per launch: this demo must never open app databases.
const dir = resolve('.work', `server-${Date.now()}`);
mkdirSync(dir, { recursive: true });
const kind = process.env.BACKEND === 'sqlite' ? 'sqlite' : 'duckdb';
const db = await SQLStore.open(kind, join(dir, `events.${kind}`));
const schemas = await SQLStore.open('sqlite', join(dir, 'app.sqlite'));
await db.initEvents(resolve('../legacy-go-backend/database/analyticsdb/analyticsmigrations/03_identity_rewrite.up.sql'));
await schemas.exec(schemaDDL);
const pipeline = new Pipeline(db, schemas);
const server = await serve(raw => pipeline.ingest(raw), Number(process.env.PORT ?? 3033));
console.log(`PoC ${kind} ingestion: POST ${server.url}/events; data in ${dir}`);
console.log('Local benchmark/demo only: no authentication. POST /finish to close cleanly.');
await server.done;
db.close(); schemas.close();
