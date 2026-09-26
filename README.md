# Quacklytics 🦆

Self-hosted analytics with a TypeScript backend and analytical queries running in your browser.

## Development

Use Bun **1.3.4** (the runtime used for benchmarks and E2E validation).

```sh
bun install --frozen-lockfile
cp .env.example apps/web/.env.local
bun run storage:up
bun run dev
```

Garage runs at `http://127.0.0.1:3900` with a private `quacklytics` bucket. `storage:up` is repeatable and configures CORS for the development and test origins. `bun run storage:down` stops it while retaining its named volume. The example credentials are public and intended only for local development.

Open `http://127.0.0.1:3000`, register the first administrator, then create a project.
Registration closes after the first account. Project settings provide ingestion keys and allowed browser origins.

```sh
bun run build
bun run start
```

`bun run check` builds the production app, type-checks, lints, checks browser/server boundaries, and runs Playwright E2E tests. Install the test browser once with `bunx playwright install chromium` (Linux CI uses `--with-deps`). Start Garage with `bun run storage:up` before testing. Tests use fresh temporary SQLite directories, unique project object prefixes in the development bucket, and the production server.

## Workspace

- `apps/web`: TanStack Start application and TypeScript backend worker.
- `packages/contracts`: Zod schemas and inferred API, chart, query, and event types shared across the application.
- `packages/tracker`: TypeScript ingestion client, pageviews, click tracking, and consent UI.
- `apps/home`: Astro documentation website.
- `tests/e2e`: browser, HTTP, tracker retry, and process crash/restart flows.
- `poc/ingestion`: original benchmark harness and results.
- `poc/legacy-go-backend`: historical Go implementation retained for those benchmarks; excluded from the app and Docker image.

TanStack Start/Router handles routing, Query handles requests and analytical query caching, DB provides reactive insight/dashboard collections, Form handles authentication/project creation, Store holds browser state, Table/Virtual render tabular data, Charts renders analytics, Pacer debounces queries, and Hotkeys provides query execution shortcuts.

Bun's native `bun:sqlite` is authoritative. Every connection enables WAL, `synchronous=FULL`, foreign keys, and a busy timeout. App metadata/authentication lives in `app.sqlite`; each project has its own SQLite database. HTTP ingestion commits events, sessions, identities, schemas, idempotency records, and export jobs in one transaction before acknowledging the request.

A backend worker isolates synchronous SQLite from the web server. DuckDB on the server converts snapshots to compressed Parquet, stages them temporarily, and uploads them to S3 before publishing the catalog. S3 is the only supported Parquet store. DuckDB-WASM executes analytical SQL over an `events` view referencing private S3 objects through signed HTTPS URLs (HTTP on localhost). Browser reads use HTTP ranges, without importing whole snapshots into a local events table. Export jobs survive restarts, retry every 30 seconds, and also run on catalog requests. Browser catalogs refresh every 15 seconds while visible. Revisions include late events and identity changes. Signed URLs expire after one hour and refresh before expiry, including after an inactive tab resumes. Superseded objects are retained for one hour after replacement; background cleanup also removes abandoned uploads.

Exports are partitioned by UTC month. Only dirty partitions are rebuilt; identity upgrades also invalidate historical session partitions. A consistent SQLite read transaction captures all dirty partitions before the catalog is atomically published. All historical partitions are available to browser queries through remote Parquet reads. Open or reload the project to fetch the latest catalog; there is no periodic data refresh. Signed access is renewed when needed for queries in long-lived tabs. The benchmark figures in `poc` measure ingestion pipelines, not this complete HTTP application.

## Configuration and Docker

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_ORIGIN` | `http://127.0.0.1:3000` | Exact public origin for authentication |
| `DATA_DIR` | `./data` relative to `apps/web` | Durable SQLite/auth directory |
| `S3_ENDPOINT` | Required | Backend S3-compatible endpoint |
| `S3_PUBLIC_ENDPOINT` | `S3_ENDPOINT` | Browser-reachable endpoint used when signing URLs |
| `S3_REGION` | Required | Bucket region (`garage` for local development) |
| `S3_BUCKET` | Required | Private Parquet bucket |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Required | Backend-only bucket credentials |
| `PORT` | `3000` | Production listen port |
| `HOST` | `0.0.0.0` | Production bind address |
| `AUTH_SECRET` | Generated and persisted in `DATA_DIR/auth-secret` | Optional stable authentication secret |

```sh
docker compose up --build
```

The included Compose file starts Garage and the app for local development, using `http://localhost:3000` and persistent SQLite and Garage volumes. For production, supply your own private S3 bucket and credentials; configure its CORS to allow your app origin, GET/HEAD and Range, and expose Content-Range, Content-Length, Accept-Ranges, ETag and Last-Modified (see `dev/cors.json`). The browser endpoint must be accessible to users and use HTTPS outside localhost. Set `APP_ORIGIN` to your external HTTPS origin behind a reverse proxy. Keep one application process per data directory on a local filesystem. To back up, stop the service and copy the entire data directory, including the auth secret and SQLite WAL files. Back up the S3 bucket as well. Local Parquet directories and the old download endpoint are no longer supported. Existing SQLite events are automatically re-exported when the S3 destination is first configured or changed; old local Parquet files are not read.

This is a breaking, pre-deployment migration: use a **new empty data directory**. The old Go database, HOCON config, password hashes, and ingestion protocol are not imported. Startup rejects unmarked nonempty directories.

## Ingestion

`POST /api/ingest`, with `Content-Type: application/json` and `X-API-KEY` from project settings:

```json
{
  "requestId": "bb7b720a-0d30-4f6b-a159-910a56b70c51",
  "events": [{
    "id": "24fc73e5-aa9b-4c28-bc3f-3bd02a5bc0c3",
    "eventType": "signup",
    "timestamp": "2026-09-25T12:00:00Z",
    "sessionId": "browser-session",
    "personId": "person-1",
    "properties": {"plan": "pro"},
    "personProperties": {"name": "Ada"}
  }]
}
```

Batches contain 1–1000 events and at most 2 MB of JSON. Retry the same payload with the same request/event IDs after transport errors or 5xx/429 responses. Reusing an ID with different content returns 409 and rolls back the batch. Response `{committed, duplicates, revision}` is sent after commit. Nested JSON values retain their types. Sending a session and person together links historical anonymous events; a session cannot be reassigned to a different person. Person properties use event timestamp, then event ID, to resolve ties deterministically.

```ts
import { createClient } from '@quacklytics/client'

const client = createClient({
  hostname: 'https://analytics.example.com',
  apiKey: 'your-project-key',
  autoTrackPageviews: false,
})
await client.send({ eventType: 'signup', properties: { plan: 'pro' } })
```

The tracker creates stable IDs and retries transient failures without duplicating committed events. Browser ingestion requires its exact origin in the project's allowed origins; server-to-server ingestion requires the key. Administrative endpoints require the administrator's session cookie.

See [AGENTS.md](AGENTS.md) for the E2E-first testing policy [MIGRATION_REPORT.md](MIGRATION_REPORT.md) for implementation/verification results, and [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for the original design.

## Development demo data

Generate realistic Orbit product activity through your local ingestion endpoint:

```sh
QUACKLYTICS_API_KEY=your-local-key bun run seed:dev
```

To create a new demo project with all six chart types already configured, supply your existing local admin credentials:

```sh
QUACKLYTICS_PASSWORD=your-local-password bun run seed:dev --email you@example.com
```

Defaults are 250 users per chart family and 365 days of history (roughly 350 events per day). Run `bun run seed:dev --help` for options and see [the demo guide](scripts/demo/README.md) for event names and chart recipes. Each run adds a fresh dataset.

### DuckDB WASM range-read patch

DuckDB-WASM is pinned to `1.32.0`, the latest stable version published on npm.

`patches/@duckdb%2Fduckdb-wasm@1.32.0.patch` fixes the MVP worker's signed-URL range probe to read `Content-Range` instead of splitting `Content-Length` ([upstream issue #2228](https://github.com/duckdb/duckdb-wasm/issues/2228)). Bun applies it on install. Browser E2E coverage verifies HTTP 206 reads directly from Garage; keep that assertion when upgrading DuckDB.
