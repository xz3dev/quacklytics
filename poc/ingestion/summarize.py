"""Regenerate RESULTS.md from the completed larger-batch benchmark (stdlib only)."""
import json
from collections import defaultdict
from pathlib import Path
from statistics import median

root = Path(__file__).resolve().parent
data = json.loads((root / "results/large-batches.json").read_text())
followup = json.loads((root / "results/bun-comparison.json").read_text())
meta = data["metadata"]
all_results = data["results"] + followup["results"]
assert all(r["externalReferenceVerified"] for r in followup["results"])
assert all(r["eventContentsVerified"] and r["jsonStorageValid"] and r["matchesCorrectedState"] for r in all_results)
results = [r for r in data["results"] if r["implementation"] != "ts-sqlite"] + followup["results"]
assert all(r["eventContentsVerified"] and r["jsonStorageValid"] and r["matchesCorrectedState"] for r in results)
implementations = ["go-duckdb", "go-sqlite", "ts-duckdb", "ts-sqlite", "bun-sqlite"]
groups = defaultdict(list)
for row in results:
    groups[row["mode"], row["scenario"], row["batchSize"], row["implementation"]].append(row)


def value(mode, scenario, batch, implementation, metric="eventsPerSecond"):
    return median(r[metric] for r in groups[mode, scenario, batch, implementation])


def table(mode, scenario, metric="eventsPerSecond"):
    lines = [
        "| Batch | Go + DuckDB | Go + SQLite | Node + DuckDB | Node + SQLite | Bun + SQLite |",
        "|---:|---:|---:|---:|---:|---:|",
    ]
    for batch in meta["batches"]:
        cells = [value(mode, scenario, batch, impl, metric) for impl in implementations]
        formatted = [f"{v:,.0f}" if metric == "eventsPerSecond" else f"{v:,.1f}" for v in cells]
        lines.append(f"| {batch:,} | " + " | ".join(formatted) + " |")
    return "\n".join(lines)


versions = sorted({(r["implementation"], r["runtime"], str(r["duckdb"]), r["sqlite"]) for r in results})
version_table = "\n".join(["| Implementation | Runtime | DuckDB | SQLite |", "|---|---|---|---|"] + [f"| {' | '.join(v)} |" for v in versions])
identity_small_gain = value("pipeline", "identity", 100, "go-sqlite") / value("pipeline", "identity", 100, "go-duckdb")
hashes = defaultdict(set)
for r in results:
    hashes[r["mode"], r["scenario"]].add(r["snapshotSha256"])
cross_batch = all(len(s) == 1 for s in hashes.values())
bun_gains = ", ".join(f"{batch:,}: {(value('pipeline', 'identity', batch, 'bun-sqlite') / value('pipeline', 'identity', batch, 'ts-sqlite') - 1) * 100:+.1f}%" for batch in meta["batches"])
text = f"""# Larger batches: Go, Node, and Bun

Historical report: these measurements predate DuckDB statement caching and matched
event indexes. See [the newer WAL comparison](WAL_RESULTS.md). The reproduction
commands below now use the updated harness and will not recreate this exact setup.

The production Go JSON encoding bug is fixed. All measurements below use valid
JSON-object storage; the broken implementation and temporary correction wrapper
are no longer benchmark options.

Measured on {meta['cpu']} ({meta['arch']}), {meta['memoryGiB']:.0f} GiB RAM,
{meta['platform']} {meta['os']}. Each configuration has {meta['repeats']} fresh-process
runs, **{meta['events']:,} measured events** and **{meta['warmupEvents']:,} warmup events**
per run. Competitors run sequentially, with rotating order.
The initial four-stack matrix contains 144 runs. A follow-up repeats Node SQLite
alongside Bun SQLite in alternating order (72 runs). Tables use those newer Node
results and the original other stacks: 180 selected measurements, 216 collected.
All follow-up snapshots also match the saved fixed Go baseline. All databases are
file-backed; SQLite uses DELETE journaling and FULL synchronous writes.

## Full pipeline throughput: anonymous events

Median completed events/second. Includes JSON decoding, UUID generation,
normalization, sorting, schema discovery/persistence, and event writes.

{table('pipeline', 'anonymous')}

## Full pipeline throughput: identity updates

Also includes session/person lookups, historical property replay, timestamp-based
property merging, and persistence of identities. Median completed events/second.

{table('pipeline', 'identity')}

At batch size 100, switching the existing Go pipeline to SQLite improves this
identity workload by **{identity_small_gain:.1f}×**. This isolates a storage choice
that does not require a TypeScript rewrite. It does not mean SQLite is faster for
every workload: compare the anonymous and append-only tables as well.

Bun's identity throughput relative to Node SQLite by batch size: **{bun_gains}**.
Both execute the same TypeScript pipeline. Compare p95 below as well; throughput
improvements do not necessarily mean more consistent batch latency.

## Identity workload batch latency

Median of the three per-run batch p95 values, in **milliseconds**. These are
processing durations, not per-event HTTP latency, and exclude waiting for a batch
to fill. A batch of 10,000 has only ten measured samples per run, so its p95 is
coarse (the largest sample with this percentile convention).

{table('pipeline', 'identity', 'batchP95Ms')}

## Append-only control

Median completed events/second. Includes decoding, normalization, UUIDs, JSON
serialization and event persistence, but skips sorting, schemas and identities.

{table('append', 'anonymous')}

## Correctness and interpretation

- **{len(all_results)} measured runs passed** event-content, distinct-ID, SQL JSON-object,
  and cross-implementation identity/schema verification after closing and
  reopening the databases.
- Logical state also matches across all batch sizes for each workload: **{cross_batch}**.
- The identity fixture cycles through **{meta['identitySlots']} identity slots**. Large
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

{version_table}

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
"""
(root / "RESULTS.md").write_text(text)
print(f"Generated RESULTS.md from {len(results)} verified measurements")
