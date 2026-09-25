"""Render the WAL/cached-DuckDB comparison using only the Python stdlib."""
import json
from collections import defaultdict
from pathlib import Path
from statistics import median

root = Path(__file__).resolve().parent
data = json.loads((root / 'results/wal-comparison.json').read_text())
meta, results = data['metadata'], data['results']
assert len(results) == 264
for r in results:
    assert all(r[k] for k in ['eventContentsVerified', 'jsonStorageValid', 'matchesCorrectedState', 'externalReferenceVerified'])
    for settings in r['sqliteSettings'].values():
        assert settings['fullfsync'] == 0 and settings['checkpoint_fullfsync'] == 1
        assert settings['wal_autocheckpoint'] == 1000 and settings['foreign_keys'] == 1
        assert settings['page_size'] == 4096
        assert settings['cache_size'] == -16000 and settings['mmap_size'] == 0
        assert settings['temp_store'] == 1 and settings['secure_delete'] == 0
        assert settings['locking_mode'] == 'normal' and settings['automatic_index'] == 1
        assert settings['journal_mode'] == r['sqliteProfile'].split('-')[0]
        assert settings['synchronous'] == (1 if r['sqliteProfile'] == 'wal-normal' else 2)
    assert r['duckdbStatementCache'] == r['implementation'].endswith('duckdb')
groups = defaultdict(list)
for r in results:
    groups[r['scenario'], r['batchSize'], r['implementation'], r['sqliteProfile']].append(r)
assert all(len(rows) == 3 for rows in groups.values())

def val(scenario, batch, implementation, profile, metric='eventsPerSecond'):
    return median(r[metric] for r in groups[scenario, batch, implementation, profile])

def sqlite_table(scenario, metric='eventsPerSecond'):
    out = ['| Runtime | Batch | DELETE + FULL | WAL + FULL | WAL + NORMAL | WAL FULL / DELETE |', '|---|---:|---:|---:|---:|---:|']
    for impl, label in [('go-sqlite', 'Go'), ('ts-sqlite', 'Node'), ('bun-sqlite', 'Bun')]:
        for b in meta['batches']:
            vs = [val(scenario, b, impl, p, metric) for p in meta['sqliteProfiles']]
            cells = [f'{v:,.0f}' if metric.startswith('eventsPerSecond') else f'{v:,.1f}' for v in vs]
            out.append(f'| {label} | {b:,} | ' + ' | '.join(cells) + f' | {vs[1]/vs[0]:.2f}× |')
    return '\n'.join(out)

def duck_table(scenario):
    out = ['| Batch | Go DuckDB cached | Go SQLite WAL FULL | Node DuckDB cached | Node SQLite WAL FULL | Bun SQLite WAL FULL |', '|---:|---:|---:|---:|---:|---:|']
    for b in meta['batches']:
        vs = [val(scenario, b, impl, 'delete-full' if impl.endswith('duckdb') else 'wal-full') for impl in ['go-duckdb','go-sqlite','ts-duckdb','ts-sqlite','bun-sqlite']]
        out.append(f'| {b:,} | ' + ' | '.join(f'{v:,.0f}' for v in vs) + ' |')
    return '\n'.join(out)

versions = sorted({(r['implementation'], r['runtime'], str(r['duckdb']), r['sqlite']) for r in results})
version_table = '\n'.join(['| Implementation | Runtime | DuckDB | SQLite |', '|---|---|---|---|'] + [f"| {' | '.join(v)} |" for v in versions])
wal = [r for r in results if r['sqliteProfile'].startswith('wal')]
penalties = [(1-r['eventsPerSecondIncludingCheckpoint']/r['eventsPerSecond'])*100 for r in wal]
normal_gains = [val(s, b, impl, 'wal-normal') / val(s, b, impl, 'wal-full') for s in ['anonymous','identity'] for b in meta['batches'] for impl in ['go-sqlite','ts-sqlite','bun-sqlite']]
text = f'''# SQLite WAL and cached DuckDB ingestion comparison

{len(results)} verified runs on {meta['cpu']}, {meta['memoryGiB']:.0f} GiB RAM,
{meta['platform']} {meta['os']}. Each setting has three fresh-process repeats,
100,000 measured events and 10,000 warmup events. Runs are serial, rotating the
order across repetitions. All full-pipeline results include event decoding,
normalization, schema work and completed event writes. Identity workloads also
include sessions, person updates, and historical property replay.

## Recommendation for the tested workload

At the current production batch size of 100, **WAL + FULL** is the throughput
choice: identified-event throughput improves by 28% in Go, 38% in Node, and 74%
in Bun over DELETE + FULL. It has higher batch p95 latency at this batch size
(Go 11.5 → 19.7 ms, Node 9.9 → 18.1 ms, Bun 10.3 → 14.6 ms).
Choose based on the desired throughput/latency balance, rather than throughput alone.

**Keep FULL instead of NORMAL.** NORMAL ranges from roughly 2% slower to 5%
faster across the tested combinations, with weaker commit durability. There is
no consistent large gain here to justify that tradeoff.

For consistently large batches, **DELETE + FULL remains competitive**: at
10,000 events it is 4–6% faster for identity ingestion across all three runtimes.
This is not a universal WAL win or a global optimum; it is the outcome with the
recorded checkpoint policy, one writer and no concurrent readers on this Mac.

Caching DuckDB statements does not erase SQLite's small-batch identity advantage:
Go DuckDB reaches 2,597 events/s versus Go SQLite WAL FULL's 13,438 at batch 100.
DuckDB remains faster for anonymous ingestion within Go and Node.

## SQLite full pipeline: identified workload

Median events/second; higher is better.

{sqlite_table('identity')}

## SQLite full pipeline: anonymous workload

Median events/second; higher is better.

{sqlite_table('anonymous')}

## Cached DuckDB versus WAL FULL SQLite

Both DuckDB implementations now cache parameterized statements per connection.
Every event store has the ID, timestamp, and session indexes. DuckDB still uses
its appender; SQLite uses cached inserts in a transaction.

Identified workload, median events/second:

{duck_table('identity')}

Anonymous workload, median events/second:

{duck_table('anonymous')}

These supersede the earlier uncached DuckDB comparisons for this setup. The
previous report is historical: it also lacked DuckDB timestamp/session indexes.
The DuckDB schema catalog remains SQLite DELETE + FULL; the WAL profiles change
both the event database and schema catalog for SQLite implementations.

## Batch processing latency

Median of the three per-run p95 values in milliseconds; lower is better. Queue
wait is excluded. At batch 10,000 there are only ten timed batches per run, so
p95 is the largest observation and should not be treated as a stable tail estimate.

Identified workload:

{sqlite_table('identity', 'batchP95Ms')}

Anonymous workload:

{sqlite_table('anonymous', 'batchP95Ms')}

## Checkpoint accounting and durability

Automatic checkpoints remain enabled at **1,000 pages** (4 KiB pages), and their
cost is included in ingestion throughput and batch latency. After ingestion,
both SQLite files are explicitly checkpointed with `wal_checkpoint(TRUNCATE)`.
The raw report records this remaining work as `checkpointMs`, and includes an
additional rate, `eventsPerSecondIncludingCheckpoint`. Both checkpoints must
complete without a busy result. The final drain can include work from warmup.

Across WAL runs, final checkpoint time was median **{median(r['checkpointMs'] for r in wal):.1f} ms**,
maximum **{max(r['checkpointMs'] for r in wal):.1f} ms**. Including it lowers throughput
by median **{median(penalties):.2f}%**, maximum **{max(penalties):.2f}%**.

WAL NORMAL / WAL FULL median-throughput ratios across the 24 runtime/workload/
batch combinations range from **{min(normal_gains):.2f}× to {max(normal_gains):.2f}×**.
NORMAL does not sync the WAL at each commit, so it can lose committed transactions
on OS crash or power loss. FULL syncs the WAL at commit. Reopening successfully
checks logical persistence; this benchmark does not simulate power loss.
See [SQLite synchronous documentation](https://sqlite.org/pragma.html#pragma_synchronous).

The SQLite page-cache budget is **16,000 KiB per connection** for all runtimes.
The old defaults differed (Go 2,000 KiB, Node 16,000 KiB, Bun 2,000 pages ≈8 MiB).
This is another reason to use this report for comparing stacks rather than the
earlier results. Memory mapping is disabled, temp storage is FILE, secure delete
is OFF, locking is NORMAL, and automatic indexes are ON in all SQLite variants.

All SQLite connections explicitly use `fullfsync=OFF` and
`checkpoint_fullfsync=ON`, matching the latter default observed in Bun's macOS
SQLite. Go and Node originally defaulted checkpoint_fullfsync to OFF, so this
comparison aligns it rather than mixing the defaults. FULL means SQLite's normal
sync policy here, not a tested hardware power-loss guarantee. Foreign keys are
ON for both event and schema databases. Actual settings are read back and stored
for every run. See [SQLite WAL](https://sqlite.org/wal.html).

## What is and is not controlled

- Identical fixtures, ID/timestamp/session indexes, statement-cache lifetimes, foreign-key
  enforcement, SQLite PRAGMAs, batch boundaries and identity semantics.
- All event contents, JSON types, unique ID counts, persons, sessions and schemas
  match after closing/reopening, including against the saved fixed Go baseline.
- The 200 recurring identity slots let large batches combine repeated person and
  session updates. This is not representative of mostly unique identities.
- Go retains its production processor and GORM schema code, without enabling
  GORM prepared-statement caching. TypeScript uses its direct-SQL port with
  cached schema statements. Event/identity statements are cached in both. SQLite
  engines and native drivers differ. This is a comparison
  of complete implementations, not a pure language or engine microbenchmark.
- DuckDB list predicates and SQLite IN predicates express the same filtering but
  may produce different query plans. No claim of identical execution plans.
- Person/session/schema/event transactions remain separate. Neither journaling
  mode makes the complete ingestion batch atomic across them.
- This is a single writer without concurrent readers. It does not benchmark WAL's
  reader/writer concurrency benefit, long-held readers, checkpoint starvation,
  multi-project operation or sustained performance on much larger datasets.
- Caching and added indexes are benchmark changes; production retains the JSON
  fix from the earlier task. No production backend or batch settings are changed.

## Versions and reproduction

{version_table}

```sh
cd poc/ingestion
npm ci
npm test
npm run test:bun
npm run bench -- --events=100000 --warmup=10000 --repeats=3 --batches=100,1000,5000,10000 --modes=pipeline --sqlite-profiles=delete-full,wal-full,wal-normal --reference=large-batches --output=wal-comparison
python3 summarize_wal.py
```

[Individual results and PRAGMAs](results/wal-comparison.json) ·
[All medians and ranges](results/wal-comparison.md) · [Harness documentation](README.md)
'''
(root / 'WAL_RESULTS.md').write_text(text)
print(f'Generated WAL_RESULTS.md from {len(results)} verified measurements')
