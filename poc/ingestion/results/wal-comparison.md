# Ingestion PoC results

```json
{
  "date": "2026-09-25T08:04:52.719Z",
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
    "go-duckdb",
    "go-sqlite",
    "ts-duckdb",
    "ts-sqlite",
    "bun-sqlite"
  ],
  "sqliteProfiles": [
    "delete-full",
    "wal-full",
    "wal-normal"
  ],
  "duckdbCache": "on",
  "eventIndexes": [
    "id",
    "timestamp",
    "session_id"
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

| Mode | Scenario | Batch | Implementation | SQLite profile | Median events/s | Min–max events/s | Median batch p95 ms |
|---|---|---:|---|---|---:|---:|---:|
| pipeline | anonymous | 100 | go-duckdb | delete-full | 47,371 | 46,707–48,476 | 2.50 |
| pipeline | anonymous | 100 | go-sqlite | delete-full | 18,541 | 18,443–18,957 | 6.50 |
| pipeline | anonymous | 100 | ts-duckdb | delete-full | 70,667 | 69,715–71,143 | 1.68 |
| pipeline | anonymous | 100 | ts-sqlite | delete-full | 21,885 | 19,670–22,732 | 5.51 |
| pipeline | anonymous | 100 | bun-sqlite | delete-full | 21,551 | 20,336–21,807 | 5.79 |
| pipeline | anonymous | 100 | go-sqlite | wal-full | 25,376 | 24,481–25,427 | 15.44 |
| pipeline | anonymous | 100 | ts-sqlite | wal-full | 31,829 | 30,307–33,321 | 14.62 |
| pipeline | anonymous | 100 | bun-sqlite | wal-full | 39,419 | 38,140–39,670 | 11.32 |
| pipeline | anonymous | 100 | go-sqlite | wal-normal | 25,916 | 24,699–26,211 | 15.73 |
| pipeline | anonymous | 100 | ts-sqlite | wal-normal | 32,270 | 31,815–32,630 | 15.32 |
| pipeline | anonymous | 100 | bun-sqlite | wal-normal | 40,717 | 39,523–42,513 | 11.99 |
| pipeline | identity | 100 | go-duckdb | delete-full | 2,597 | 2,583–2,843 | 44.88 |
| pipeline | identity | 100 | go-sqlite | delete-full | 10,530 | 10,512–10,641 | 11.54 |
| pipeline | identity | 100 | ts-duckdb | delete-full | 2,685 | 2,594–2,848 | 46.81 |
| pipeline | identity | 100 | ts-sqlite | delete-full | 12,416 | 11,094–12,569 | 9.92 |
| pipeline | identity | 100 | bun-sqlite | delete-full | 12,296 | 11,914–12,485 | 10.28 |
| pipeline | identity | 100 | go-sqlite | wal-full | 13,438 | 13,406–14,415 | 19.69 |
| pipeline | identity | 100 | ts-sqlite | wal-full | 17,113 | 16,646–17,816 | 18.12 |
| pipeline | identity | 100 | bun-sqlite | wal-full | 21,379 | 19,821–21,553 | 14.63 |
| pipeline | identity | 100 | go-sqlite | wal-normal | 13,938 | 13,425–14,025 | 20.91 |
| pipeline | identity | 100 | ts-sqlite | wal-normal | 17,017 | 16,788–17,211 | 19.00 |
| pipeline | identity | 100 | bun-sqlite | wal-normal | 22,469 | 22,200–22,502 | 14.88 |
| pipeline | anonymous | 1000 | go-duckdb | delete-full | 90,178 | 84,566–93,224 | 11.87 |
| pipeline | anonymous | 1000 | go-sqlite | delete-full | 42,820 | 41,981–43,717 | 29.61 |
| pipeline | anonymous | 1000 | ts-duckdb | delete-full | 135,165 | 126,745–141,127 | 9.57 |
| pipeline | anonymous | 1000 | ts-sqlite | delete-full | 55,253 | 55,111–56,106 | 24.97 |
| pipeline | anonymous | 1000 | bun-sqlite | delete-full | 57,614 | 57,454–59,074 | 23.65 |
| pipeline | anonymous | 1000 | go-sqlite | wal-full | 46,305 | 44,432–46,457 | 33.74 |
| pipeline | anonymous | 1000 | ts-sqlite | wal-full | 62,453 | 62,181–64,300 | 26.69 |
| pipeline | anonymous | 1000 | bun-sqlite | wal-full | 76,736 | 73,192–78,861 | 23.75 |
| pipeline | anonymous | 1000 | go-sqlite | wal-normal | 47,031 | 46,844–47,061 | 33.62 |
| pipeline | anonymous | 1000 | ts-sqlite | wal-normal | 61,285 | 61,155–63,442 | 28.65 |
| pipeline | anonymous | 1000 | bun-sqlite | wal-normal | 77,152 | 74,161–77,760 | 23.51 |
| pipeline | identity | 1000 | go-duckdb | delete-full | 11,830 | 11,794–11,861 | 94.33 |
| pipeline | identity | 1000 | go-sqlite | delete-full | 29,619 | 29,459–30,616 | 43.84 |
| pipeline | identity | 1000 | ts-duckdb | delete-full | 11,723 | 10,704–12,209 | 110.86 |
| pipeline | identity | 1000 | ts-sqlite | delete-full | 37,690 | 37,040–38,799 | 35.57 |
| pipeline | identity | 1000 | bun-sqlite | delete-full | 40,744 | 37,171–40,951 | 34.12 |
| pipeline | identity | 1000 | go-sqlite | wal-full | 31,545 | 31,278–31,681 | 44.05 |
| pipeline | identity | 1000 | ts-sqlite | wal-full | 37,323 | 36,975–38,353 | 40.02 |
| pipeline | identity | 1000 | bun-sqlite | wal-full | 48,024 | 45,175–48,042 | 29.96 |
| pipeline | identity | 1000 | go-sqlite | wal-normal | 31,576 | 30,467–31,782 | 44.18 |
| pipeline | identity | 1000 | ts-sqlite | wal-normal | 38,394 | 37,914–38,593 | 37.97 |
| pipeline | identity | 1000 | bun-sqlite | wal-normal | 47,594 | 47,048–48,166 | 30.79 |
| pipeline | anonymous | 5000 | go-duckdb | delete-full | 96,719 | 96,578–98,402 | 73.10 |
| pipeline | anonymous | 5000 | go-sqlite | delete-full | 69,668 | 69,116–72,397 | 82.43 |
| pipeline | anonymous | 5000 | ts-duckdb | delete-full | 149,993 | 149,158–151,589 | 40.09 |
| pipeline | anonymous | 5000 | ts-sqlite | delete-full | 104,121 | 103,282–105,956 | 59.89 |
| pipeline | anonymous | 5000 | bun-sqlite | delete-full | 112,551 | 112,048–118,305 | 57.46 |
| pipeline | anonymous | 5000 | go-sqlite | wal-full | 67,019 | 64,898–68,140 | 93.98 |
| pipeline | anonymous | 5000 | ts-sqlite | wal-full | 99,261 | 98,250–99,349 | 61.90 |
| pipeline | anonymous | 5000 | bun-sqlite | wal-full | 122,011 | 119,692–122,717 | 51.08 |
| pipeline | anonymous | 5000 | go-sqlite | wal-normal | 67,979 | 67,858–68,015 | 87.52 |
| pipeline | anonymous | 5000 | ts-sqlite | wal-normal | 98,529 | 93,568–99,642 | 63.03 |
| pipeline | anonymous | 5000 | bun-sqlite | wal-normal | 121,835 | 119,451–122,166 | 51.32 |
| pipeline | identity | 5000 | go-duckdb | delete-full | 37,006 | 36,981–37,273 | 215.95 |
| pipeline | identity | 5000 | go-sqlite | delete-full | 54,407 | 53,495–54,637 | 108.42 |
| pipeline | identity | 5000 | ts-duckdb | delete-full | 40,449 | 39,633–40,952 | 212.77 |
| pipeline | identity | 5000 | ts-sqlite | delete-full | 72,550 | 71,841–73,125 | 84.99 |
| pipeline | identity | 5000 | bun-sqlite | delete-full | 81,501 | 81,119–82,582 | 81.08 |
| pipeline | identity | 5000 | go-sqlite | wal-full | 52,943 | 52,852–52,997 | 108.02 |
| pipeline | identity | 5000 | ts-sqlite | wal-full | 69,921 | 67,401–69,936 | 86.01 |
| pipeline | identity | 5000 | bun-sqlite | wal-full | 83,104 | 82,226–84,975 | 70.15 |
| pipeline | identity | 5000 | go-sqlite | wal-normal | 52,471 | 52,325–53,894 | 108.91 |
| pipeline | identity | 5000 | ts-sqlite | wal-normal | 70,098 | 68,965–70,260 | 84.90 |
| pipeline | identity | 5000 | bun-sqlite | wal-normal | 84,523 | 83,702–85,215 | 81.60 |
| pipeline | anonymous | 10000 | go-duckdb | delete-full | 100,083 | 99,638–100,447 | 105.67 |
| pipeline | anonymous | 10000 | go-sqlite | delete-full | 79,834 | 79,541–80,435 | 135.01 |
| pipeline | anonymous | 10000 | ts-duckdb | delete-full | 149,451 | 138,187–153,377 | 75.25 |
| pipeline | anonymous | 10000 | ts-sqlite | delete-full | 122,441 | 120,006–124,931 | 91.37 |
| pipeline | anonymous | 10000 | bun-sqlite | delete-full | 134,044 | 127,074–138,682 | 86.89 |
| pipeline | anonymous | 10000 | go-sqlite | wal-full | 74,900 | 72,749–75,644 | 147.74 |
| pipeline | anonymous | 10000 | ts-sqlite | wal-full | 113,003 | 112,314–115,490 | 95.95 |
| pipeline | anonymous | 10000 | bun-sqlite | wal-full | 131,586 | 130,602–137,187 | 93.81 |
| pipeline | anonymous | 10000 | go-sqlite | wal-normal | 74,322 | 74,018–75,830 | 143.77 |
| pipeline | anonymous | 10000 | ts-sqlite | wal-normal | 112,703 | 112,282–114,167 | 96.00 |
| pipeline | anonymous | 10000 | bun-sqlite | wal-normal | 136,540 | 135,037–137,496 | 81.53 |
| pipeline | identity | 10000 | go-duckdb | delete-full | 50,200 | 49,144–51,679 | 282.88 |
| pipeline | identity | 10000 | go-sqlite | delete-full | 62,463 | 62,361–62,667 | 178.02 |
| pipeline | identity | 10000 | ts-duckdb | delete-full | 58,019 | 57,846–58,926 | 254.20 |
| pipeline | identity | 10000 | ts-sqlite | delete-full | 83,446 | 82,347–85,107 | 148.64 |
| pipeline | identity | 10000 | bun-sqlite | delete-full | 99,980 | 97,539–101,308 | 113.34 |
| pipeline | identity | 10000 | go-sqlite | wal-full | 58,883 | 58,564–60,712 | 181.15 |
| pipeline | identity | 10000 | ts-sqlite | wal-full | 80,501 | 79,545–81,138 | 133.15 |
| pipeline | identity | 10000 | bun-sqlite | wal-full | 96,479 | 92,556–98,814 | 112.36 |
| pipeline | identity | 10000 | go-sqlite | wal-normal | 60,730 | 55,951–61,180 | 177.52 |
| pipeline | identity | 10000 | ts-sqlite | wal-normal | 80,867 | 80,046–81,010 | 130.69 |
| pipeline | identity | 10000 | bun-sqlite | wal-normal | 99,056 | 97,867–100,334 | 111.37 |
