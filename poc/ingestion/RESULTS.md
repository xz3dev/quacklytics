# Larger batches: Go, Node, and Bun

Historical report: these measurements predate DuckDB statement caching and matched
event indexes. See [the newer WAL comparison](WAL_RESULTS.md). The reproduction
commands below now use the updated harness and will not recreate this exact setup.

The production Go JSON encoding bug is fixed. All measurements below use valid
JSON-object storage; the broken implementation and temporary correction wrapper
are no longer benchmark options.

Measured on Apple M2 Pro (arm64), 32 GiB RAM,
darwin 25.6.0. Each configuration has 3 fresh-process
runs, **100,000 measured events** and **10,000 warmup events**
per run. Competitors run sequentially, with rotating order.
The initial four-stack matrix contains 144 runs. A follow-up repeats Node SQLite
alongside Bun SQLite in alternating order (72 runs). Tables use those newer Node
results and the original other stacks: 180 selected measurements, 216 collected.
All follow-up snapshots also match the saved fixed Go baseline. All databases are
file-backed; SQLite uses DELETE journaling and FULL synchronous writes.

## Full pipeline throughput: anonymous events

Median completed events/second. Includes JSON decoding, UUID generation,
normalization, sorting, schema discovery/persistence, and event writes.

| Batch | Go + DuckDB | Go + SQLite | Node + DuckDB | Node + SQLite | Bun + SQLite |
|---:|---:|---:|---:|---:|---:|
| 100 | 49,762 | 19,173 | 72,094 | 22,303 | 21,770 |
| 1,000 | 90,901 | 40,488 | 138,679 | 53,945 | 57,240 |
| 5,000 | 100,430 | 65,082 | 154,781 | 104,458 | 116,719 |
| 10,000 | 103,192 | 73,670 | 153,396 | 124,678 | 137,877 |

## Full pipeline throughput: identity updates

Also includes session/person lookups, historical property replay, timestamp-based
property merging, and persistence of identities. Median completed events/second.

| Batch | Go + DuckDB | Go + SQLite | Node + DuckDB | Node + SQLite | Bun + SQLite |
|---:|---:|---:|---:|---:|---:|
| 100 | 2,016 | 9,761 | 2,086 | 12,585 | 12,489 |
| 1,000 | 10,085 | 28,246 | 9,759 | 38,437 | 40,032 |
| 5,000 | 34,486 | 47,695 | 36,730 | 73,686 | 82,539 |
| 10,000 | 48,600 | 51,651 | 52,815 | 83,721 | 102,459 |

At batch size 100, switching the existing Go pipeline to SQLite improves this
identity workload by **4.8×**. This isolates a storage choice
that does not require a TypeScript rewrite. It does not mean SQLite is faster for
every workload: compare the anonymous and append-only tables as well.

Bun's identity throughput relative to Node SQLite by batch size: **100: -0.8%, 1,000: +4.1%, 5,000: +12.0%, 10,000: +22.4%**.
Both execute the same TypeScript pipeline. Compare p95 below as well; throughput
improvements do not necessarily mean more consistent batch latency.

## Identity workload batch latency

Median of the three per-run batch p95 values, in **milliseconds**. These are
processing durations, not per-event HTTP latency, and exclude waiting for a batch
to fill. A batch of 10,000 has only ten measured samples per run, so its p95 is
coarse (the largest sample with this percentile convention).

| Batch | Go + DuckDB | Go + SQLite | Node + DuckDB | Node + SQLite | Bun + SQLite |
|---:|---:|---:|---:|---:|---:|
| 100 | 62.2 | 12.1 | 66.7 | 9.8 | 9.7 |
| 1,000 | 110.4 | 45.2 | 123.3 | 34.6 | 33.8 |
| 5,000 | 200.5 | 129.4 | 199.0 | 81.2 | 107.9 |
| 10,000 | 264.7 | 233.1 | 246.3 | 140.7 | 111.1 |

## Append-only control

Median completed events/second. Includes decoding, normalization, UUIDs, JSON
serialization and event persistence, but skips sorting, schemas and identities.

| Batch | Go + DuckDB | Go + SQLite | Node + DuckDB | Node + SQLite | Bun + SQLite |
|---:|---:|---:|---:|---:|---:|
| 100 | 104,839 | 23,480 | 121,623 | 25,286 | 24,803 |
| 1,000 | 184,561 | 51,982 | 216,629 | 62,616 | 65,575 |
| 5,000 | 199,710 | 95,508 | 241,225 | 137,790 | 156,372 |
| 10,000 | 199,082 | 108,524 | 229,245 | 167,486 | 202,129 |

## Correctness and interpretation

- **216 measured runs passed** event-content, distinct-ID, SQL JSON-object,
  and cross-implementation identity/schema verification after closing and
  reopening the databases.
- Logical state also matches across all batch sizes for each workload: **True**.
- The identity fixture cycles through **200 identity slots**. Large
  batches coalesce multiple events for the same person/session into fewer writes.
  This is a real optimization for this fixture, but the gain will be smaller with
  mostly unique identities. No pure batching-overhead claim is implied.
- Go + SQLite calls the same production Go processor and GORM schema code. A
  benchmark-only adapter translates list predicates/parameters and substitutes
  transactional SQLite event inserts. All SQLite event stores have timestamp
  and session indexes and cache prepared statements. The SQLite backend itself
  is not added to production.
- TypeScript uses direct SQL and a different schema-inference implementation;
  this is an implementation comparison, not a pure language benchmark.
- All SQLite variants keep a separate schema database, matching the current
  transaction boundaries. An event batch is not atomic across persons, sessions,
  schemas and events. No durability settings were relaxed to improve numbers.
- Measurements include any checkpoints that happen during ingestion, but not
  the final close/checkpoint. This remains a single-project synthetic workload;
  it does not establish long-running production capacity, many-tenant behavior,
  memory use, concurrent analytics, or performance on much larger databases.
- The existing production batch size of 100 and five-second flush timer were
  not changed. A higher batch cap should be paired with a latency target for
  flushing partially filled batches. TypeScript SQLite runs synchronous native
  calls; production event-loop isolation would need separate evaluation.

The Go JSON fix uses `json.RawMessage` for already-serialized event and person
properties. A regression test verifies SQL object types and nested extraction
(including arrays, numbers, booleans and empty objects). This fixes new ingestion;
previously stored rows and Parquet files are not rewritten.

Bun uses the same TypeScript pipeline and SQL as Node, with native `bun:sqlite`
for both event and schema databases. Neither Node native addon is loaded on this
path. SQLite versions differ between stacks; these measurements do not isolate
runtime or driver overhead. Bun 1.3.4 is the installed version tested here.

## Versions and reproduction

| Implementation | Runtime | DuckDB | SQLite |
|---|---|---|---|
| bun-sqlite | bun-1.3.4 | None | 3.51.0 |
| go-duckdb | go1.26.4 | v1.5.2 | 3.53.0 |
| go-sqlite | go1.26.4 | None | 3.53.0 |
| ts-duckdb | v25.2.1 | v1.5.2 | 3.53.1 |
| ts-sqlite | v25.2.1 | None | 3.53.1 |

```sh
cd poc/ingestion
npm ci
npm test
npm run test:bun
npm run bench -- --events=100000 --warmup=10000 --repeats=3 --batches=100,1000,5000,10000 --implementations=go-duckdb,go-sqlite,ts-duckdb,ts-sqlite --output=large-batches
npm run bench -- --events=100000 --warmup=10000 --repeats=3 --batches=100,1000,5000,10000 --implementations=ts-sqlite,bun-sqlite --reference=large-batches --output=bun-comparison
python3 summarize.py
```

See [methodology](README.md), [all medians/ranges](results/large-batches.md),
[original measurements](results/large-batches.json), and
[Bun/Node follow-up measurements](results/bun-comparison.json).
