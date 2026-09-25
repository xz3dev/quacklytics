# Ingestion PoC results

```json
{
  "date": "2026-09-25T07:20:12.236Z",
  "gitCommit": "beb833f3f822311d15ecb3f7420a568add669b23",
  "platform": "darwin",
  "arch": "arm64",
  "os": "25.6.0",
  "cpu": "Apple M2 Pro",
  "logicalCpus": 10,
  "memoryGiB": 32,
  "events": 100000,
  "warmupEvents": 10000,
  "identitySlots": 200,
  "implementations": [
    "ts-sqlite",
    "bun-sqlite"
  ],
  "referenceReport": "large-batches",
  "repeats": 3,
  "batches": [
    100,
    1000,
    5000,
    10000
  ],
  "transport": "direct"
}
```

All runs verify logical event contents and IDs after reopening, and compare identity/schema state across implementations.

All implementations must store JSON objects and pass identical logical-state checks. The Go + DuckDB baseline includes the production JSON fix; no broken variant is measured. See [methodology](../README.md).

| Mode | Scenario | Batch | Implementation | Median events/s | Min–max events/s | Median batch p95 ms |
|---|---|---:|---|---:|---:|---:|
| pipeline | anonymous | 100 | ts-sqlite | 22,303 | 21,807–22,983 | 5.38 |
| pipeline | anonymous | 100 | bun-sqlite | 21,770 | 20,611–22,155 | 5.64 |
| pipeline | identity | 100 | ts-sqlite | 12,585 | 12,380–12,674 | 9.85 |
| pipeline | identity | 100 | bun-sqlite | 12,489 | 12,393–12,554 | 9.73 |
| append | anonymous | 100 | ts-sqlite | 25,286 | 25,221–25,754 | 4.92 |
| append | anonymous | 100 | bun-sqlite | 24,803 | 24,513–24,832 | 5.22 |
| pipeline | anonymous | 1000 | ts-sqlite | 53,945 | 53,018–55,653 | 26.29 |
| pipeline | anonymous | 1000 | bun-sqlite | 57,240 | 55,937–59,438 | 22.97 |
| pipeline | identity | 1000 | ts-sqlite | 38,437 | 38,026–39,495 | 34.63 |
| pipeline | identity | 1000 | bun-sqlite | 40,032 | 39,518–41,018 | 33.84 |
| append | anonymous | 1000 | ts-sqlite | 62,616 | 57,578–65,772 | 22.87 |
| append | anonymous | 1000 | bun-sqlite | 65,575 | 65,201–66,049 | 21.67 |
| pipeline | anonymous | 5000 | ts-sqlite | 104,458 | 102,342–104,795 | 60.36 |
| pipeline | anonymous | 5000 | bun-sqlite | 116,719 | 116,330–118,429 | 54.23 |
| pipeline | identity | 5000 | ts-sqlite | 73,686 | 72,415–74,092 | 81.22 |
| pipeline | identity | 5000 | bun-sqlite | 82,539 | 81,255–83,727 | 107.91 |
| append | anonymous | 5000 | ts-sqlite | 137,790 | 134,450–139,440 | 48.44 |
| append | anonymous | 5000 | bun-sqlite | 156,372 | 153,548–157,114 | 44.71 |
| pipeline | anonymous | 10000 | ts-sqlite | 124,678 | 119,124–125,086 | 88.42 |
| pipeline | anonymous | 10000 | bun-sqlite | 137,877 | 132,706–140,509 | 92.91 |
| pipeline | identity | 10000 | ts-sqlite | 83,721 | 79,345–84,890 | 140.69 |
| pipeline | identity | 10000 | bun-sqlite | 102,459 | 98,738–102,619 | 111.05 |
| append | anonymous | 10000 | ts-sqlite | 167,486 | 162,643–167,800 | 79.53 |
| append | anonymous | 10000 | bun-sqlite | 202,129 | 199,778–203,268 | 60.83 |
