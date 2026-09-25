# SQLite WAL and cached DuckDB ingestion comparison

264 verified runs on Apple M2 Pro, 32 GiB RAM,
darwin 25.6.0. Each setting has three fresh-process repeats,
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

| Runtime | Batch | DELETE + FULL | WAL + FULL | WAL + NORMAL | WAL FULL / DELETE |
|---|---:|---:|---:|---:|---:|
| Go | 100 | 10,530 | 13,438 | 13,938 | 1.28× |
| Go | 1,000 | 29,619 | 31,545 | 31,576 | 1.07× |
| Go | 5,000 | 54,407 | 52,943 | 52,471 | 0.97× |
| Go | 10,000 | 62,463 | 58,883 | 60,730 | 0.94× |
| Node | 100 | 12,416 | 17,113 | 17,017 | 1.38× |
| Node | 1,000 | 37,690 | 37,323 | 38,394 | 0.99× |
| Node | 5,000 | 72,550 | 69,921 | 70,098 | 0.96× |
| Node | 10,000 | 83,446 | 80,501 | 80,867 | 0.96× |
| Bun | 100 | 12,296 | 21,379 | 22,469 | 1.74× |
| Bun | 1,000 | 40,744 | 48,024 | 47,594 | 1.18× |
| Bun | 5,000 | 81,501 | 83,104 | 84,523 | 1.02× |
| Bun | 10,000 | 99,980 | 96,479 | 99,056 | 0.96× |

## SQLite full pipeline: anonymous workload

Median events/second; higher is better.

| Runtime | Batch | DELETE + FULL | WAL + FULL | WAL + NORMAL | WAL FULL / DELETE |
|---|---:|---:|---:|---:|---:|
| Go | 100 | 18,541 | 25,376 | 25,916 | 1.37× |
| Go | 1,000 | 42,820 | 46,305 | 47,031 | 1.08× |
| Go | 5,000 | 69,668 | 67,019 | 67,979 | 0.96× |
| Go | 10,000 | 79,834 | 74,900 | 74,322 | 0.94× |
| Node | 100 | 21,885 | 31,829 | 32,270 | 1.45× |
| Node | 1,000 | 55,253 | 62,453 | 61,285 | 1.13× |
| Node | 5,000 | 104,121 | 99,261 | 98,529 | 0.95× |
| Node | 10,000 | 122,441 | 113,003 | 112,703 | 0.92× |
| Bun | 100 | 21,551 | 39,419 | 40,717 | 1.83× |
| Bun | 1,000 | 57,614 | 76,736 | 77,152 | 1.33× |
| Bun | 5,000 | 112,551 | 122,011 | 121,835 | 1.08× |
| Bun | 10,000 | 134,044 | 131,586 | 136,540 | 0.98× |

## Cached DuckDB versus WAL FULL SQLite

Both DuckDB implementations now cache parameterized statements per connection.
Every event store has the ID, timestamp, and session indexes. DuckDB still uses
its appender; SQLite uses cached inserts in a transaction.

Identified workload, median events/second:

| Batch | Go DuckDB cached | Go SQLite WAL FULL | Node DuckDB cached | Node SQLite WAL FULL | Bun SQLite WAL FULL |
|---:|---:|---:|---:|---:|---:|
| 100 | 2,597 | 13,438 | 2,685 | 17,113 | 21,379 |
| 1,000 | 11,830 | 31,545 | 11,723 | 37,323 | 48,024 |
| 5,000 | 37,006 | 52,943 | 40,449 | 69,921 | 83,104 |
| 10,000 | 50,200 | 58,883 | 58,019 | 80,501 | 96,479 |

Anonymous workload, median events/second:

| Batch | Go DuckDB cached | Go SQLite WAL FULL | Node DuckDB cached | Node SQLite WAL FULL | Bun SQLite WAL FULL |
|---:|---:|---:|---:|---:|---:|
| 100 | 47,371 | 25,376 | 70,667 | 31,829 | 39,419 |
| 1,000 | 90,178 | 46,305 | 135,165 | 62,453 | 76,736 |
| 5,000 | 96,719 | 67,019 | 149,993 | 99,261 | 122,011 |
| 10,000 | 100,083 | 74,900 | 149,451 | 113,003 | 131,586 |

These supersede the earlier uncached DuckDB comparisons for this setup. The
previous report is historical: it also lacked DuckDB timestamp/session indexes.
The DuckDB schema catalog remains SQLite DELETE + FULL; the WAL profiles change
both the event database and schema catalog for SQLite implementations.

## Batch processing latency

Median of the three per-run p95 values in milliseconds; lower is better. Queue
wait is excluded. At batch 10,000 there are only ten timed batches per run, so
p95 is the largest observation and should not be treated as a stable tail estimate.

Identified workload:

| Runtime | Batch | DELETE + FULL | WAL + FULL | WAL + NORMAL | WAL FULL / DELETE |
|---|---:|---:|---:|---:|---:|
| Go | 100 | 11.5 | 19.7 | 20.9 | 1.71× |
| Go | 1,000 | 43.8 | 44.0 | 44.2 | 1.00× |
| Go | 5,000 | 108.4 | 108.0 | 108.9 | 1.00× |
| Go | 10,000 | 178.0 | 181.2 | 177.5 | 1.02× |
| Node | 100 | 9.9 | 18.1 | 19.0 | 1.83× |
| Node | 1,000 | 35.6 | 40.0 | 38.0 | 1.12× |
| Node | 5,000 | 85.0 | 86.0 | 84.9 | 1.01× |
| Node | 10,000 | 148.6 | 133.1 | 130.7 | 0.90× |
| Bun | 100 | 10.3 | 14.6 | 14.9 | 1.42× |
| Bun | 1,000 | 34.1 | 30.0 | 30.8 | 0.88× |
| Bun | 5,000 | 81.1 | 70.2 | 81.6 | 0.87× |
| Bun | 10,000 | 113.3 | 112.4 | 111.4 | 0.99× |

Anonymous workload:

| Runtime | Batch | DELETE + FULL | WAL + FULL | WAL + NORMAL | WAL FULL / DELETE |
|---|---:|---:|---:|---:|---:|
| Go | 100 | 6.5 | 15.4 | 15.7 | 2.37× |
| Go | 1,000 | 29.6 | 33.7 | 33.6 | 1.14× |
| Go | 5,000 | 82.4 | 94.0 | 87.5 | 1.14× |
| Go | 10,000 | 135.0 | 147.7 | 143.8 | 1.09× |
| Node | 100 | 5.5 | 14.6 | 15.3 | 2.65× |
| Node | 1,000 | 25.0 | 26.7 | 28.6 | 1.07× |
| Node | 5,000 | 59.9 | 61.9 | 63.0 | 1.03× |
| Node | 10,000 | 91.4 | 96.0 | 96.0 | 1.05× |
| Bun | 100 | 5.8 | 11.3 | 12.0 | 1.95× |
| Bun | 1,000 | 23.7 | 23.7 | 23.5 | 1.00× |
| Bun | 5,000 | 57.5 | 51.1 | 51.3 | 0.89× |
| Bun | 10,000 | 86.9 | 93.8 | 81.5 | 1.08× |

## Checkpoint accounting and durability

Automatic checkpoints remain enabled at **1,000 pages** (4 KiB pages), and their
cost is included in ingestion throughput and batch latency. After ingestion,
both SQLite files are explicitly checkpointed with `wal_checkpoint(TRUNCATE)`.
The raw report records this remaining work as `checkpointMs`, and includes an
additional rate, `eventsPerSecondIncludingCheckpoint`. Both checkpoints must
complete without a busy result. The final drain can include work from warmup.

Across WAL runs, final checkpoint time was median **5.8 ms**,
maximum **27.0 ms**. Including it lowers throughput
by median **0.33%**, maximum **1.58%**.

WAL NORMAL / WAL FULL median-throughput ratios across the 24 runtime/workload/
batch combinations range from **0.98× to 1.05×**.
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
npm run bench -- --events=100000 --warmup=10000 --repeats=3 --batches=100,1000,5000,10000 --modes=pipeline --sqlite-profiles=delete-full,wal-full,wal-normal --reference=large-batches --output=wal-comparison
python3 summarize_wal.py
```

[Individual results and PRAGMAs](results/wal-comparison.json) ·
[All medians and ranges](results/wal-comparison.md) · [Harness documentation](README.md)
