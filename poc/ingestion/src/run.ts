import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { cpus, totalmem, platform, arch, release } from 'node:os';
import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { performance } from 'node:perf_hooks';

const args = new Map(process.argv.slice(2).map(s => {
  const [key, value = 'true'] = s.replace(/^--/, '').split('=');
  return [key, value] as const;
}));
const count = Number(args.get('events') ?? 10000), repeats = Number(args.get('repeats') ?? 3);
const batches = (args.get('batches') ?? '100,1000').split(',').map(Number);
const scenarios = (args.get('scenarios') ?? 'anonymous,identity').split(',');
const modes = (args.get('modes') ?? 'pipeline,append').split(',');
const http = args.get('transport') === 'http';
const warmupCount = Number(args.get('warmup') ?? 1000);
const identitySlots = Number(args.get('identity-slots') ?? 200);
assert(Number.isInteger(warmupCount) && warmupCount > 0);
assert(Number.isInteger(identitySlots) && identitySlots > 0);
assert(count > 0 && repeats > 0 && batches.every(b => b > 0 && Number.isInteger(b)));
assert(scenarios.every(s => ['anonymous', 'identity'].includes(s)));
assert(modes.every(s => ['pipeline', 'append'].includes(s)));
const root = resolve('../..'), work = resolve('.work', `run-${Date.now()}`);
mkdirSync(work, { recursive: true }); mkdirSync('results', { recursive: true });
const goBinary = join(work, 'go-ingestion.test');
console.log('Building the actual Go processor (outside timing)...');
execFileSync('go', ['test', '-tags=ingestionpoc', '-c', '-o', goBinary, './domain/events/processor'], { cwd: join(root, 'poc/legacy-go-backend'), stdio: 'inherit' });

function makeEvents(n: number, scenario: string, prefix: string) {
  const base = Date.parse('2026-01-15T12:00:00Z');
  return Array.from({ length: n }, (_, i) => ({
    eventType: ['page_view', 'click', 'purchase', 'identify'][i % 4],
    timestamp: new Date(base + i * 1000 + i % 997 - (i % 17 === 0 ? 600000 : 0)).toISOString(),
    ...(scenario === 'identity' && i % 10 !== 9 ? { sessionId: `${prefix}s${i % identitySlots}` } : {}),
    ...(scenario === 'identity' && i >= identitySlots && i % 3 !== 0 ? { personId: `${prefix}p${i % identitySlots}` } : {}),
    properties: { path: `/page/${i % 20}`, duration: i % 97, success: i % 3 === 0, campaign: `campaign-${i % 5}` },
    personProperties: scenario === 'identity' ? { plan: ['free', 'paid', 'enterprise'][Math.floor(i / identitySlots) % 3], score: i % 19 } : {},
  }));
}
function partition(events: unknown[], size: number) {
  const result: string[] = [];
  for (let i = 0; i < events.length; i += size) result.push(JSON.stringify(events.slice(i, i + size)));
  return result;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value: unknown) { return createHash('sha256').update(stable(value)).digest('hex'); }
function sortRows(rows: unknown[][]) {
  return rows.map(row => ({ row, key: stable(row) })).sort((a, b) => a.key.localeCompare(b.key)).map(x => x.row);
}
type Snapshot = { events: unknown[][]; persons: unknown[][]; sessions: unknown[][]; schemas: unknown[][]; distinctIds: number };
function canonical(snapshot: Snapshot) {
  const decode = (v: unknown): unknown => JSON.parse(v as string);
  for (const row of snapshot.events) { row[4] = decode(row[4]); row[5] = decode(row[5]); }
  for (const row of snapshot.persons) {
    row[2] = JSON.parse(row[2] as string);
    row[3] = Object.fromEntries(Object.entries(JSON.parse(row[3] as string)).map(([key, value]) => [key, Date.parse(value as string)]));
  }
  snapshot.events = sortRows(snapshot.events); snapshot.persons = sortRows(snapshot.persons);
  snapshot.sessions = sortRows(snapshot.sessions); snapshot.schemas = sortRows(snapshot.schemas);
  return snapshot;
}
type Result = { implementation: string; mode: string; eventsPerSecond: number; batchP50Ms: number; batchP95Ms: number; batchP99Ms: number; [key: string]: unknown };
const results: Result[] = [];
const referenceName = args.get('reference');
let externalReference: { metadata: Record<string, unknown>; results: Result[] } | undefined;
if (referenceName) {
  assert(/^[a-zA-Z0-9_-]+$/.test(referenceName), 'reference must be a report filename stem');
  externalReference = JSON.parse(readFileSync(`results/${referenceName}.json`, 'utf8'));
  assert.equal(externalReference!.metadata.events, count);
  assert.equal(externalReference!.metadata.warmupEvents, warmupCount);
  assert.equal(externalReference!.metadata.identitySlots, identitySlots);
  assert.equal(externalReference!.metadata.transport, http ? 'http' : 'direct');
}

const availableImplementations = ['go-duckdb', 'go-sqlite', 'ts-duckdb', 'ts-sqlite', 'bun-sqlite'];
const implementations = (args.get('implementations') ?? availableImplementations.join(',')).split(',');
assert(implementations.length > 0 && implementations.every(i => availableImplementations.includes(i)));
const sqliteProfiles = (args.get('sqlite-profiles') ?? 'delete-full').split(',');
assert(sqliteProfiles.every(p => ['delete-full', 'wal-full', 'wal-normal'].includes(p)));
const duckdbCache = args.get('duckdb-cache') ?? 'on';
assert(['on', 'off'].includes(duckdbCache));
const cases = sqliteProfiles.flatMap(sqliteProfile => implementations.filter(i => i.endsWith('sqlite') || sqliteProfile === sqliteProfiles[0]).map(implementation => ({ implementation, sqliteProfile })));
for (const batchSize of batches) for (const mode of modes) for (const scenario of scenarios) {
  if (mode === 'append' && scenario !== 'anonymous') continue;
  const warmupEvents = makeEvents(warmupCount, scenario, 'warm-'), measuredEvents = makeEvents(count, scenario, 'test-');
  const fixture = { warmup: partition(warmupEvents, batchSize), batches: partition(measuredEvents, batchSize) };
  const fixtureFile = join(work, `${scenario}-${batchSize}-${mode}.json`);
  writeFileSync(fixtureFile, JSON.stringify(fixture));
  let reference: Snapshot | undefined;
  const expectedEvents = [...warmupEvents, ...measuredEvents].map(e => [Date.parse(e.timestamp), e.eventType, 'sessionId' in e ? e.sessionId : null, 'personId' in e ? e.personId : null, e.properties, e.personProperties]);
  const expectedEventHash = digest(sortRows(expectedEvents));
  for (let repeat = 0; repeat < repeats; repeat++) {
    // Rotate order to reduce systematic cache/thermal/order bias. Never run competitors concurrently.
    const offset = Math.floor(repeat * cases.length / repeats);
    const order = cases.map((_, i) => cases[(i + offset) % cases.length]);
    for (const { implementation, sqliteProfile } of order) {
      const label = `${implementation}-${sqliteProfile}-${scenario}-${mode}-b${batchSize}-r${repeat + 1}`;
      const dir = join(work, label); mkdirSync(dir);
      const env = { ...process.env, TZ: 'Etc/UTC', POC_DUCKDB_CACHE: duckdbCache, POC_SQLITE_PROFILE: sqliteProfile, POC_DIR: dir, POC_IMPLEMENTATION: implementation, POC_FIXTURE: fixtureFile, POC_MODE: mode, POC_BACKEND: implementation.endsWith('-sqlite') ? 'sqlite' : 'duckdb', POC_HTTP: http ? '1' : '0', POC_SCHEMA: join(root, 'poc/legacy-go-backend/database/analyticsdb/analyticsmigrations/03_identity_rewrite.up.sql') };
      const command = implementation.startsWith('go-') ? goBinary : implementation === 'bun-sqlite' ? (args.get('bun') ?? 'bun') : process.execPath;
      const commandArgs = implementation.startsWith('go-') ? ['-test.run=^TestIngestionPoC$', '-test.timeout=10m'] : [resolve('dist/bench.js')];
      const child = spawn(command, commandArgs, { env, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
      const completion = new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
      let httpResult: Record<string, number> = {};
      try {
        if (http) {
          const deadline = Date.now() + 60000;
          while (!existsSync(join(dir, 'ready.json'))) {
            if (child.exitCode !== null || Date.now() > deadline) throw new Error(`Server failed to start: ${output}`);
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          const { url } = JSON.parse(readFileSync(join(dir, 'ready.json'), 'utf8'));
          const send = async (raw: string, warmup: boolean) => {
            const response = await fetch(`${url}/events${warmup ? '?warmup=1' : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw, signal: AbortSignal.timeout(60000) });
            const body = await response.text();
            assert(response.ok, body); assert.equal(JSON.parse(body).persisted, JSON.parse(raw).length);
          };
          for (const raw of fixture.warmup) await send(raw, true);
          const latencies: number[] = [], start = performance.now();
          for (const raw of fixture.batches) { const t = performance.now(); await send(raw, false); latencies.push(performance.now() - t); }
          httpResult.httpEventsPerSecond = count / ((performance.now() - start) / 1000);
          latencies.sort((a, b) => a - b);
          httpResult.httpP50Ms = latencies[Math.floor(latencies.length * .5)];
          httpResult.httpP95Ms = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * .95))];
          await fetch(`${url}/finish`, { method: 'POST', signal: AbortSignal.timeout(60000) });
        }
        const code = await completion;
        if (code !== 0) throw new Error(`${label} failed (${code}):\n${output}`);
      } catch (error) { child.kill(); throw error; }
      const { jsonObjectEvents, ...rawSnapshot } = JSON.parse(readFileSync(join(dir, 'snapshot.json'), 'utf8'));
      const jsonStorageValid = jsonObjectEvents === count + warmupCount;
      assert(jsonStorageValid, `${label}: properties are not stored as JSON objects`);
      const snapshot = canonical(rawSnapshot);
      assert.equal(snapshot.distinctIds, count + warmupCount, `${label}: lost/duplicate event IDs`);
      assert.equal(digest(snapshot.events), expectedEventHash, `${label}: event contents differ from input (inspect ${dir}/snapshot.json)`);
      if (mode === 'append') {
        assert.equal(snapshot.persons.length + snapshot.sessions.length + snapshot.schemas.length, 0);
      } else if (scenario === 'identity') {
        assert(snapshot.persons.length > 0 && snapshot.sessions.length > 0, 'identity work was skipped');
        assert(snapshot.persons.some(p => (p[2] as Record<string, unknown>).plan), 'person properties missing');
      }
      if (reference && jsonStorageValid) for (const key of ['persons', 'sessions', 'schemas'] as const) {
        assert.equal(createHash('sha256').update(stable(snapshot[key])).digest('hex'), createHash('sha256').update(stable(reference[key])).digest('hex'), `${label}: ${key} differs (inspect ${dir}/snapshot.json)`);
      }
      if (!reference && jsonStorageValid) reference = snapshot;
      const result: Result = { ...JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8')), ...httpResult, sqliteProfile, scenario, batchSize, repeat: repeat + 1, transport: http ? 'http' : 'direct', eventContentsVerified: true, jsonStorageValid, snapshotSha256: createHash('sha256').update(stable(snapshot)).digest('hex') };
      if (externalReference) {
        const references = externalReference.results.filter(r => r.mode === mode && r.scenario === scenario && r.batchSize === batchSize && r.implementation === 'go-duckdb');
        assert(references.length > 0 && references.every(r => r.jsonStorageValid && r.eventContentsVerified), 'Missing valid Go reference');
        assert(references.every(r => r.snapshotSha256 === result.snapshotSha256), `${label}: differs from saved Go reference`);
        result.externalReferenceVerified = true;
      }
      results.push(result);
      writeFileSync(join(work, 'progress.json'), JSON.stringify(results));
      console.log(`${label}: ${Math.round(result.eventsPerSecond).toLocaleString()} events/s; p95 ${result.batchP95Ms.toFixed(1)}ms; events verified${http ? `; HTTP ${Math.round(httpResult.httpEventsPerSecond).toLocaleString()} events/s` : ''}`);
      if (!args.has('keep')) rmSync(dir, { recursive: true });
    }
  }
  const referenceHash = createHash('sha256').update(stable(reference)).digest('hex');
  for (const result of results.filter(r => r.scenario === scenario && r.batchSize === batchSize && r.mode === mode)) result.matchesCorrectedState = result.snapshotSha256 === referenceHash;
}
const metadata = { date: new Date().toISOString(), gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), platform: platform(), arch: arch(), os: release(), cpu: cpus()[0].model, logicalCpus: cpus().length, memoryGiB: totalmem() / 2 ** 30, events: count, warmupEvents: warmupCount, identitySlots, implementations, sqliteProfiles, duckdbCache, eventIndexes: ['id', 'timestamp', 'session_id'], referenceReport: referenceName ?? null, repeats, batches, transport: http ? 'http' : 'direct' };
const median = (numbers: number[]) => { const n = numbers.toSorted((a, b) => a - b); return n.length % 2 ? n[Math.floor(n.length / 2)] : (n[n.length / 2 - 1] + n[n.length / 2]) / 2; };
const lines = ['# Ingestion PoC results', '', '```json', JSON.stringify(metadata, null, 2), '```', '', 'All runs verify logical event contents and IDs after reopening, and compare identity/schema state across implementations.', '', 'All implementations must store JSON objects and pass identical logical-state checks. The Go + DuckDB baseline includes the production JSON fix; no broken variant is measured. See [methodology](../README.md).', '', '| Mode | Scenario | Batch | Implementation | SQLite profile | Median events/s | Min–max events/s | Median batch p95 ms |', '|---|---|---:|---|---|---:|---:|---:|'];
const groups = Map.groupBy(results, r => `${r.mode}/${r.scenario}/${r.batchSize}/${r.implementation}/${r.sqliteProfile}`);
for (const group of groups.values()) {
  const r = group[0], rates = group.map(r => http ? Number(r.httpEventsPerSecond) : r.eventsPerSecond);
  lines.push(`| ${r.mode} | ${r.scenario} | ${r.batchSize} | ${r.implementation} | ${r.sqliteProfile} | ${Math.round(median(rates)).toLocaleString()} | ${Math.round(Math.min(...rates)).toLocaleString()}–${Math.round(Math.max(...rates)).toLocaleString()} | ${median(group.map(r => http ? Number(r.httpP95Ms) : r.batchP95Ms)).toFixed(2)} |`);
}
const report = args.get('output') ?? 'latest';
assert(/^[a-zA-Z0-9_-]+$/.test(report), 'output must be a filename stem');
writeFileSync(`results/${report}.json`, JSON.stringify({ metadata, results }, null, 2));
writeFileSync(`results/${report}.md`, lines.join('\n') + '\n');
if (!args.has('keep')) rmSync(work, { recursive: true });
console.log(`Reports: results/${report}.md and results/${report}.json`);
