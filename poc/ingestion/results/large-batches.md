# Ingestion PoC results

```json
{
  "date": "2026-09-25T07:11:43.106Z",
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
    "ts-sqlite"
  ],
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

All four implementations must store JSON objects and pass identical logical-state checks. The Go + DuckDB baseline includes the production JSON fix; no broken variant is measured. See [methodology](../README.md).

| Mode | Scenario | Batch | Implementation | Median events/s | Min–max events/s | Median batch p95 ms |
|---|---|---:|---|---:|---:|---:|
| pipeline | anonymous | 100 | go-duckdb | 49,762 | 47,659–50,766 | 2.35 |
| pipeline | anonymous | 100 | go-sqlite | 19,173 | 18,349–19,238 | 6.15 |
| pipeline | anonymous | 100 | ts-duckdb | 72,094 | 71,839–74,987 | 1.60 |
| pipeline | anonymous | 100 | ts-sqlite | 22,795 | 22,722–22,932 | 5.32 |
| pipeline | identity | 100 | go-duckdb | 2,016 | 1,957–2,192 | 62.25 |
| pipeline | identity | 100 | go-sqlite | 9,761 | 9,235–10,266 | 12.11 |
| pipeline | identity | 100 | ts-duckdb | 2,086 | 2,066–2,123 | 66.67 |
| pipeline | identity | 100 | ts-sqlite | 12,220 | 11,533–12,466 | 10.05 |
| append | anonymous | 100 | go-duckdb | 104,839 | 104,325–113,258 | 1.12 |
| append | anonymous | 100 | go-sqlite | 23,480 | 21,978–23,773 | 5.23 |
| append | anonymous | 100 | ts-duckdb | 121,623 | 115,373–123,972 | 0.94 |
| append | anonymous | 100 | ts-sqlite | 24,967 | 24,959–25,358 | 4.88 |
| pipeline | anonymous | 1000 | go-duckdb | 90,901 | 83,376–91,199 | 11.82 |
| pipeline | anonymous | 1000 | go-sqlite | 40,488 | 40,272–40,877 | 32.34 |
| pipeline | anonymous | 1000 | ts-duckdb | 138,679 | 136,945–140,168 | 8.90 |
| pipeline | anonymous | 1000 | ts-sqlite | 52,968 | 52,362–54,392 | 26.04 |
| pipeline | identity | 1000 | go-duckdb | 10,085 | 9,212–10,118 | 110.42 |
| pipeline | identity | 1000 | go-sqlite | 28,246 | 27,224–28,719 | 45.22 |
| pipeline | identity | 1000 | ts-duckdb | 9,759 | 9,755–10,135 | 123.29 |
| pipeline | identity | 1000 | ts-sqlite | 37,417 | 36,891–37,577 | 35.10 |
| append | anonymous | 1000 | go-duckdb | 184,561 | 178,100–185,544 | 6.09 |
| append | anonymous | 1000 | go-sqlite | 51,982 | 48,994–52,659 | 26.60 |
| append | anonymous | 1000 | ts-duckdb | 216,629 | 199,468–225,058 | 7.27 |
| append | anonymous | 1000 | ts-sqlite | 59,979 | 59,331–60,084 | 22.90 |
| pipeline | anonymous | 5000 | go-duckdb | 100,430 | 97,698–100,690 | 52.30 |
| pipeline | anonymous | 5000 | go-sqlite | 65,082 | 64,990–66,680 | 93.06 |
| pipeline | anonymous | 5000 | ts-duckdb | 154,781 | 153,158–155,392 | 37.77 |
| pipeline | anonymous | 5000 | ts-sqlite | 104,905 | 103,453–104,910 | 62.59 |
| pipeline | identity | 5000 | go-duckdb | 34,486 | 34,402–34,681 | 200.47 |
| pipeline | identity | 5000 | go-sqlite | 47,695 | 46,903–47,942 | 129.36 |
| pipeline | identity | 5000 | ts-duckdb | 36,730 | 35,877–37,161 | 199.04 |
| pipeline | identity | 5000 | ts-sqlite | 73,742 | 72,054–74,171 | 82.47 |
| append | anonymous | 5000 | go-duckdb | 199,710 | 199,583–202,903 | 26.13 |
| append | anonymous | 5000 | go-sqlite | 95,508 | 94,403–98,742 | 71.28 |
| append | anonymous | 5000 | ts-duckdb | 241,225 | 238,023–242,868 | 25.46 |
| append | anonymous | 5000 | ts-sqlite | 135,731 | 125,440–140,742 | 47.71 |
| pipeline | anonymous | 10000 | go-duckdb | 103,192 | 99,882–104,606 | 99.13 |
| pipeline | anonymous | 10000 | go-sqlite | 73,670 | 69,867–73,986 | 155.88 |
| pipeline | anonymous | 10000 | ts-duckdb | 153,396 | 150,317–158,090 | 69.21 |
| pipeline | anonymous | 10000 | ts-sqlite | 124,162 | 123,446–124,506 | 89.37 |
| pipeline | identity | 10000 | go-duckdb | 48,600 | 46,578–48,767 | 264.70 |
| pipeline | identity | 10000 | go-sqlite | 51,651 | 50,183–51,985 | 233.11 |
| pipeline | identity | 10000 | ts-duckdb | 52,815 | 52,151–54,147 | 246.27 |
| pipeline | identity | 10000 | ts-sqlite | 81,779 | 81,588–83,111 | 132.91 |
| append | anonymous | 10000 | go-duckdb | 199,082 | 198,452–201,920 | 53.35 |
| append | anonymous | 10000 | go-sqlite | 108,524 | 108,329–108,865 | 114.15 |
| append | anonymous | 10000 | ts-duckdb | 229,245 | 221,444–231,762 | 53.29 |
| append | anonymous | 10000 | ts-sqlite | 163,401 | 162,253–167,642 | 72.02 |
