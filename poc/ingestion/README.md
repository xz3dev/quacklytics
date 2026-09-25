# TypeScript event ingestion PoC

An isolated comparison against the **actual Go ingestion processor**, plus a
small TypeScript port with DuckDB and SQLite storage adapters, plus a Go SQLite
adapter and Bun’s native `bun:sqlite`. The Go baseline includes the production JSON-encoding fix. Benchmarks
use isolated temporary databases and never open production data. This is a benchmark/demo, not a
replacement ingestion service.

See [the WAL and cached-DuckDB comparison](WAL_RESULTS.md) and
[the earlier larger-batch comparison](RESULTS.md), with raw measurements
under [results/](results/).

## Run

Requires Node 22+ (native addons must support the installed version), npm, Go
matching `poc/legacy-go-backend/go.mod`, Bun (tested with 1.3.4), and a platform supported by both DuckDB bindings.
Bun is optional when excluded with `--implementations`.

```sh
cd poc/ingestion
npm ci
npm test
npm run test:bun
npm run smoke
npm run bench -- --events=100000 --warmup=10000 --repeats=3 --batches=100,1000,5000,10000 --output=large-batches
```

To compare SQLite journaling modes and cached DuckDB:

```sh
npm run bench -- --events=100000 --warmup=10000 --repeats=3 --batches=100,1000,5000,10000 --modes=pipeline --sqlite-profiles=delete-full,wal-full,wal-normal --reference=large-batches --output=wal-comparison
python3 summarize_wal.py
```

`--reference` requires the saved report with matching fixtures; omit it for a
standalone run, which still verifies input contents and cross-implementation state.
`--sqlite-profiles` defaults to `delete-full`. SQLite implementations run each
requested profile; DuckDB runs once per configuration, with its SQLite schema
catalog using the first profile. `--duckdb-cache=off` disables statement caching
in both DuckDB adapters for controlled comparisons; it is enabled by default.

The full run executes competitors **sequentially**, rotating their order between
repetitions. Do not run other benchmarks concurrently. Results are saved as
`results/latest.json` (individual measurements) and `results/latest.md` (medians
and ranges). Use `--output=my-run` to preserve a named report. Failed runs retain
their isolated `.work/` databases for inspection; successful runs remove them
unless `--keep` is set.

Other options:

```sh
# Compare completed writes over loopback HTTP, one request in flight.
npm run bench -- --transport=http --events=3000 --repeats=3 --batches=100 --modes=pipeline --output=http

# Focus on database appends, including JSON decoding and UUID generation.
npm run bench -- --modes=append --scenarios=anonymous --events=50000
```

`--scenarios=anonymous,identity`, `--modes=pipeline,append`, `--batches=100,1000`,
`--events=10000`, `--warmup=1000`, `--identity-slots=200`, and `--repeats=3`
are the defaults. Use `--implementations=go-duckdb,go-sqlite,ts-duckdb,ts-sqlite,bun-sqlite`
to select implementations (all five by default). Append mode runs only the
anonymous fixture. Go is compiled once per invocation, outside timing. Node
and Bun execute compiled JavaScript. Use `--bun=/path/to/bun` to override the Bun executable.
`--reference=large-batches` additionally verifies snapshots against the saved
Go baseline in that report; fixture settings must match.

## What is compared

| Implementation | Description |
|---|---|
| `go-duckdb` | Actual production `processBatch` / `PersistEvents`, including the JSON fix, with a benchmark-only statement-cache wrapper |
| `go-sqlite` | The same Go processor and GORM schema catalog, with a benchmark-only SQLite dialect/appender adapter |
| `ts-duckdb` | TypeScript pipeline, official native `@duckdb/node-api` appender, cached statements, SQLite schema catalog |
| `ts-sqlite` | Same TypeScript pipeline on Node, `better-sqlite3` inserts and schema catalog |
| `bun-sqlite` | Same TypeScript pipeline on Bun, native `bun:sqlite` inserts and schema catalog |

The two DuckDB bindings are pinned to engine **1.5.2** for this comparison.
Actual engine/runtime versions are included in each result. SQLite versions can
differ between Go, Node, and Bun; they are also recorded.

Both language implementations perform JSON decoding, normalization, UUID
generation, timestamp sorting, schema/value inference and persistence, session
and person lookup, historical session-property replay, timestamp-based property
merging, person/session persistence, and event writes. Append mode skips sorting,
schema work, and identities in both languages.

The Go SQLite adapter translates the three DuckDB list predicates to
`IN (SELECT value FROM json_each(?))` and numbered parameters to SQLite syntax.
It caches prepared statements per connection, performs event inserts in a
transaction, and retains the existing Go identity/schema algorithms. No
production SQLite backend is introduced. SQLite timestamp columns are declared
DATETIME in Go so the existing scanner receives `time.Time`; TS uses ISO text.
Both store text timestamps and have the same logical indexes and constraints.

TypeScript preserves the Go identity read/transaction boundaries, bulk insert
of new identities, per-row update pattern, and separate schema transaction.
It uses direct SQL and cached SQLite prepared statements rather than GORM. This
is an implementation comparison, **not a pure language microbenchmark**.

All event stores now have timestamp and session-ID indexes in addition to the
ID primary key. Both DuckDB adapters now cache parameterized statements for the
connection lifetime, as SQLite does. These are benchmark-only changes; the older
reports used uncached DuckDB without the two additional indexes.

SQLite defaults to `journal_mode=DELETE` and `synchronous=FULL`. Optional profiles
are `wal-full` and `wal-normal`, applied to both the event and schema database.
WAL NORMAL trades commit durability on power/OS failure for less sync work; it
is reported separately rather than treated as equivalent to FULL.
All SQLite connections enable foreign keys and explicitly set
`wal_autocheckpoint=1000`, `fullfsync=OFF`, and `checkpoint_fullfsync=ON`.
The checkpoint setting aligns Go and Node with the observed macOS Bun default.
SQLite page-cache budgets are fixed at 16,000 KiB per connection across runtimes
(the earlier defaults differed). Memory mapping and secure deletion are disabled,
temp storage is FILE, locking is NORMAL, and automatic indexes are enabled.
Every benchmark reads back and records actual PRAGMAs. No variant uses
`synchronous=OFF` or an in-memory database. All variants store data in
fresh files on the local filesystem. DuckDB retains its default settings.
Child processes run with `TZ=Etc/UTC`, matching backend startup.

## Workload and measurement

- Each process warms up with `--warmup` events (1,000 by default) before measuring
  the requested event count. The larger comparison uses 10,000 warmup events. Warmup identities have different IDs from measured identities.
- Four event types and four scalar event properties: path, numeric duration,
  boolean success, and campaign. Values have bounded cardinality.
- Anonymous workload: no person/session handling.
- Identity workload: `--identity-slots` recurring identity slots (200 by default), some fully anonymous events,
  initially anonymous sessions, later identification, repeated person updates,
  and events arriving ten minutes late. Person properties include plan and score.
- Batch size 100 matches production; larger sizes are sensitivity experiments. The
  normal queue's five-second flush timer and queue residence time are excluded.
- Direct timing starts before decoding each batch and ends after the pipeline
  completes event persistence. Fixture generation, database/schema setup,
  compilation, warmup, verification, and shutdown checkpoints are excluded.
  For WAL, automatic checkpoints during ingestion are included. A final TRUNCATE
  checkpoint of both databases is timed separately as `checkpointMs`; the result
  also records `eventsPerSecondIncludingCheckpoint`.
- Console logging is disabled for both implementations. Go's logging helper
  and test harness exist only under the `ingestionpoc` build tag.
- HTTP mode adds a loopback request/response around the same pipeline and uses
  one request in flight. HTTP responses follow persistence. It does not benchmark
  the existing endpoint's early queue acknowledgment, auth, CORS, TLS, or routing.
- Reports contain per-run throughput, batch p50/p95/p99, and repeated-run
  medians/ranges. HTTP reports use client-observed throughput/p95 in their table;
  the JSON retains both client and pipeline measurements.

These are short, single-project, single-machine tests. Small batches/runs can
produce noisy numbers; p95 with only ten batches is particularly coarse. This
does not establish sustained production capacity, tail latency under overload,
memory usage, performance with millions of existing rows, high-cardinality
schema values, concurrent analytical queries, or multiple tenants.

The full batch is **not atomic**, just as in the current implementation:
persons, sessions, schemas, and events commit separately. Successful reopening
checks persistence, not power-loss behavior or crash recovery across those
transactions. A production migration should address these semantics separately.

## Correctness checks and production JSON fix

Every run closes and reopens its databases, then checks:

1. Exact event count and number of distinct generated UUIDs.
2. Every event's timestamp, type, identities, and both property objects against
   the input (order-independent comparison).
3. Persons, sessions, schemas, and discovered values across all implementations.
4. SQL-level `json_type(properties)` and `json_type(person_properties)`.

All implementations must pass the JSON-object checks; double-encoded JSON fails
rather than being unwrapped. No broken Go variant is measured. The production
appender now passes `json.RawMessage` instead of a string for the two already
serialized property objects, avoiding an extra encoding layer. A Go regression
test checks empty objects, nested objects, arrays, booleans, numbers, and SQL JSON
extraction. This fixes new writes; existing rows/files are not rewritten.

TypeScript regression tests separately assert historical property replay,
latest-by-timestamp behavior, first/last-seen times, SQL identity resolution, and
persisted JSON object types. Results retain the `matchesCorrectedState` field
name from the original runner; it now simply means cross-implementation logical
state parity against the fixed production baseline.

## Local HTTP demo

```sh
npm run serve
# Or: BACKEND=sqlite npm run serve
curl -X POST http://127.0.0.1:3033/events \
  -H 'Content-Type: application/json' \
  -d '[{"eventType":"page_view","sessionId":"s1","timestamp":"2026-01-01T00:00:00Z","properties":{"path":"/docs"}}]'
curl -X POST http://127.0.0.1:3033/finish
```

Each launch creates fresh files in `.work/server-*`. This demo listens only on
loopback, has no authentication, limits request bodies to 8 MiB, and serializes
writes with a bounded pending-request count. It intentionally has no production
validation, retry/idempotency protocol, disk-backed queue, migrations, chunk
exports, or S3 integration. Unsupported nested event-schema properties are
rejected; person properties may be JSON objects. Timestamps use JavaScript
millisecond precision. The existing Go API accepts finer timestamp precision,
so a full migration needs an explicit precision policy.

Bun and Node SQLite share SQL definitions and the pipeline, with equivalent
statement caching and transaction boundaries. The Bun path does not load Node
native addons. `npm run test:bun` runs the identity regression test with native
Bun SQLite. Installed SQLite versions differ, so this compares complete stacks.
Go and TypeScript DuckDB caches hold prepared statements until connection close;
the Go cache wraps the native driver while retaining the actual production
processor. `--duckdb-cache=off` bypasses both DuckDB caches.

Sources used for the implementation:
[DuckDB Node API](https://duckdb.org/docs/current/clients/node_neo/overview),
[Bun SQLite](https://bun.sh/docs/runtime/sqlite),
plus the installed driver source/types.
