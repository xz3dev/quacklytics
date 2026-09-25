# Project guidelines

- Use TypeScript for application/backend code and Bun's native `bun:sqlite` with WAL and `synchronous=FULL` for authoritative storage.
- Prefer TanStack libraries wherever they fit an existing product responsibility.
- Never use `any`, unsafe type assertions, double assertions, non-null assertions, or type-check suppression comments to bypass correctness. Validate external values and infer types from schemas.
- Focus testing on end-to-end user flows and observable behavior. If an end-to-end test can verify a result, prefer it over a unit test.
- Every unit test must have a specific, documented purpose that end-to-end coverage cannot reasonably serve. Avoid tests tied to narrow implementation details. Transaction failure injection, deterministic crash recovery, or otherwise inaccessible failure paths may justify targeted lower-level tests.
- Run the relevant end-to-end flows for changes and retain meaningful assertions about results, persistence, errors, and isolation; page-load smoke tests alone are insufficient.
