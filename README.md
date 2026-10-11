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

`bun run check` validates source imports, builds the production app, type-checks, lints, checks browser/server bundles, runs unit tests (including targeted gateway/worker failure tests), and runs Playwright E2E tests. Install the test browser once with `bunx playwright install chromium` (Linux CI uses `--with-deps`). Start Garage with `bun run storage:up` before testing. Tests use fresh temporary SQLite directories, unique project object prefixes in the development bucket, and the production server.

## Workspace

- `apps/web`: TanStack Start application and TypeScript backend worker.
- `packages/contracts`: Zod schemas and inferred API, chart, query, and event types shared across the application.
- `packages/tracker`: TypeScript ingestion client, pageviews, click tracking, and consent UI.
- `apps/home`: Astro documentation website.
- `tests/e2e`: browser, HTTP, tracker retry, and process crash/restart flows.
- `poc/ingestion`: original benchmark harness and results.
- `poc/legacy-go-backend`: historical Go implementation retained for those benchmarks; excluded from the app and Docker image.
- `poc/legacy-tools`: historical tooling, excluded from the app and Docker image.

TanStack Start/Router handles routing, Query handles requests and analytical query caching, DB provides reactive insight/dashboard collections, Form handles authentication/project creation, Store holds browser state, Table/Virtual render tabular data, Charts renders analytics, Pacer debounces queries, and Hotkeys provides query execution shortcuts.

Bun's native `bun:sqlite` is authoritative. Every connection enables WAL, `synchronous=FULL`, foreign keys, and a busy timeout. App metadata/authentication lives in `app.sqlite`; each project has its own SQLite database. HTTP ingestion commits events, sessions, identities, schemas, idempotency records, and export jobs in one transaction before acknowledging the request.

The HTTP gateway forwards API requests to a Bun backend worker. Capacity counts queued and running backend requests, including work whose HTTP response has timed out; overload returns 503 with Retry-After. Timeouts do not cancel mutations, so ingestion retries must retain their request/event IDs. A second worker serializes Parquet exports and cleanup, keeping synchronous snapshot reads and DuckDB conversion off the API worker. The export queue coalesces requests by project and is bounded. Durable SQLite jobs survive worker or process restarts.

Server DuckDB exports monthly ZSTD Parquet snapshots to private S3 once each UTC day, covering completed days only (the ongoing month ends at midnight at the start of today). A 30-second background sweep discovers closed days and retries failed exports; current-day ingestion does not cause S3 uploads. Late arrivals and identity changes mark affected months for repair while they are still in SQLite. Seven days after a month ends, once its Parquet file has been downloaded and verified, the month is **archived**: its rows are deleted from SQLite (only its bounds and event types remain in `archived_partitions`/`archived_event_types`) and it exists only in S3. `/api/ingest` drops events for archived months and reports them as `rejected`; `POST /api/backfill` merges them into the stored file instead, and archived rows win over re-sent IDs. Identity changes do not re-attribute archived months. The authenticated `/api/:project/events/snapshot` response (gzip-compressed when the client accepts it) pins signed Parquet coverage and SQLite events to one consistent read transaction. Browser DuckDB-WASM imports these events into a local table and exposes a single `events` view combining that table with S3 HTTP range reads. Normally SQLite supplies only today; unpublished or dirty history that has not been archived is supplied temporarily in place of stale Parquet, keeping results complete through midnight, failures and repairs. Archived months always come from S3, so backfilled rows appear once their merge has succeeded. The browser fetches the snapshot every 15 seconds while visible, and on manual refresh, and atomically replaces the table and view when the files or revision changed. Catalog/status reads never trigger exports; `POST /api/:project/events/catalog/gen` explicitly requests publication of eligible history. Superseded objects are retained for one hour; hourly background cleanup reclaims abandoned uploads.

`GET /api/:project/events/status` reports historical publication state, including committed/exported revisions, publication time, pending exports and a safe error message. The browser uses `/events/snapshot` to refresh its combined data every 15 seconds while visible and immediately when an inactive tab resumes. Failed refreshes keep the last loaded results and expose a manual retry. Export failures remain visible while SQLite supplies unpublished history. The exported revision describes the historical snapshot and can lag the committed revision while today's events remain in SQLite.

Signed URLs expire after one hour and are renewed before expiry. Browser database instances are owned by the mounted project provider: startup occurs in an effect, and switching projects or leaving the app aborts catalog requests, cancels analytical queries, releases query caches, and closes the database worker. Analytics queries consume Query cancellation signals and discard canceled results. Queries use interruptible pending execution, including prepared queries with native parameter binding. Leaving a project terminates its worker even if a prepared query has not yielded.

Application screens and React hooks live in `src/app`, `src/components`, and `src/services`; browser HTTP clients live in `src/client/api`, and the DuckDB runtime in `src/client/analytics`. Entity query definitions in `src/data` own insight/dashboard fetching and keys. Detail hooks select from the same list cache used by TanStack DB collections; mutations refresh dependent entity lists, including dashboards containing changed insights.

Backend handlers delegate project, insight, dashboard, and template operations to `src/server/domain`. Domain services own business rules and transaction boundaries; `src/server/repositories` owns their SQLite reads and writes. Shared Zod contracts distinguish creation/update commands from responses. Dashboard commands contain insight references; ordered membership and optional card layout are stored in `dashboard_insights`, with foreign keys that remove membership when an insight is deleted. Migration `0002_dashboard_membership` converts existing embedded snapshots and supports downgrade. Expanded API responses use current insight records.

Analytical builders share field quoting, property paths, typed predicates, and parameter binding through `src/lib/sql/compiler.ts`. Unprefixed property names are literal JSON keys; an explicit `$.` prefix is a JSON path. `IN` filters use comma-separated values consistently across events and charts.

`bun run check:imports` rejects server/native imports in browser and shared source, except the explicit Start API gateway route, and enforces the repository/domain dependency direction. `check:boundaries` also scans the built browser bundle. Session checks use TanStack Query: only an HTTP 401 means signed out, while outages show a retryable session error.

The benchmark figures in `poc` measure ingestion pipelines, not this complete HTTP application.

## Configuration and Docker

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_ORIGIN` | `http://127.0.0.1:3000` | Exact public origin for authentication |
| `DATA_DIR` | `./data` relative to `apps/web` | Durable SQLite/auth directory |
| `S3_ENDPOINT` | Required | Backend S3-compatible endpoint |
| `S3_PUBLIC_ENDPOINT` | `S3_ENDPOINT` | Browser-reachable endpoint used when signing URLs |
| `S3_REGION` | Required | Bucket region (`garage` for local development) |
| `S3_BUCKET` | Required | Private Parquet bucket |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Required | Backend-only bucket credentials (list, read, write, delete). If any S3 variable is missing, the UI loads but every API request returns 503 |
| `PORT` | `3000` | Production listen port |
| `HOST` | `0.0.0.0` | Production bind address |
| `TRUSTED_PROXIES` | None | Comma-separated IPs/CIDRs of your reverse proxies, or the presets `loopback` and `private`. Their `X-Forwarded-For` entries identify the client for anonymous visitor counting and auth rate limits; without it, the socket address is used and forwarded headers are ignored |
| `AUTH_SECRET` | Generated and persisted in `DATA_DIR/auth-secret` | Optional stable authentication secret |

```sh
docker compose up --build
```

The included Compose file starts Garage and the app for local development, using `http://localhost:3000` and persistent SQLite and Garage volumes. For production, supply your own private S3 bucket and credentials; configure its CORS to allow your app origin, GET/HEAD and Range, and expose Content-Range, Content-Length, Accept-Ranges, ETag and Last-Modified (see `dev/cors.json`). The browser endpoint must be accessible to users; use HTTPS when the app is served over HTTPS (browsers block mixed content; the server does not check this). Set `APP_ORIGIN` to your external HTTPS origin behind a reverse proxy, and set `TRUSTED_PROXIES` to the proxy's address (for example `private` when it reaches the app over a Docker network); otherwise every anonymous visitor appears to come from the proxy. Keep one application process per data directory on a local filesystem. To back up, stop the service and copy the entire data directory, including the auth secret and SQLite WAL files. **Back up the S3 bucket too: archived months exist only there.** Local Parquet directories and the old download endpoint are no longer supported. When the S3 destination (endpoint and bucket) is first configured or changed, SQLite events are re-exported to it, but only while no month has been archived. Once archived months exist, a changed destination makes exports fail until the previous endpoint and bucket are restored. `GET /api/proxy-check` reports whether `TRUSTED_PROXIES` matches how requests arrive, and the app shows a setup hint when it doesn't.

## Releases

Publishing a GitHub release with a new `vX.Y.Z` tag runs full CI on the tagged commit, then publishes `@quacklytics/client@X.Y.Z` to npm (dist-tag `latest`; `vX.Y.Z-rc.N` publishes to `next`), attaches the package tarball to the release, and pushes `ghcr.io/xz3dev/quacklytics/{amd64,arm64}` images tagged `X.Y.Z`, `X.Y` and `latest`. The tag is the only version source: the workflow stamps it into the client's `package.json` and `SDK_VERSION`, so no version bump commit is needed.

Every push to `master` publishes a nightly: `@quacklytics/client@<next patch>-nightly.sha-<commit>` on the npm `nightly` dist-tag and images tagged `nightly` and the full commit SHA. `bun run check:client` packs the client, installs it into a clean project and imports every entrypoint.

## Database migrations

[Umzug](https://github.com/sequelize/umzug) manages versioned SQL migrations through a Bun SQLite storage adapter. Files live in `apps/web/src/server/db/migrations/{app,project}` as matching pairs, for example `0006_add_feature.up.sql` and `0006_add_feature.down.sql` (names must match `NNNN_lower_snake_case.(up|down).sql`). Use increasing numeric versions within each database scope. Both files are required. Never edit an applied migration: checksums cover both directions. Add a new pair instead.

`bun run dev` automatically runs the web workspace’s `predev` task first, migrating the app database and every registered project in `DATA_DIR` (including initializing a fresh directory). Migration failures prevent the dev server from starting. You can also run it directly with `bun run --cwd apps/web predev`.

Startup applies app migrations before authentication initializes. Project migrations apply when a project database is opened. Existing SQLite version-1 ledgers are adopted after validating their original checksum; existing projects, credentials, and ingestion keys are retained. Better Auth schema changes now require explicit SQL migrations when upgrading the dependency.

From the repository root, with the application stopped:

```sh
bun run db:migrate status app apps/web/data/app.sqlite
bun run db:migrate up app apps/web/data/app.sqlite
bun run db:migrate down app apps/web/data/app.sqlite
bun run db:migrate down app apps/web/data/app.sqlite 1
bun run db:migrate up project apps/web/data/projects/PROJECT_ID/project.sqlite
```

Commands require an existing SQLite file. `up` applies all pending migrations, or stops at an optional target version. `down` reverts one version by default; an explicit target is the version to **keep** (`0` reverts everything). `status` lists applied and pending versions. Each invocation uses one immediate transaction for SQL and history, so a failure rolls back the entire invocation. WAL, `synchronous=FULL`, and foreign keys remain enabled. Migration SQL must not contain transaction-control statements or change connection pragmas; the adapter owns the transaction.

The production build includes SQL files and `dist/migrate.js`. In the container's `/app/apps/web` directory, use `bun run db:migrate status app /data/app.sqlite` (or `up` / `down`). Run project commands for each project file that needs an explicit rollback. Stop the service and back up the data directory before rolling back; down migrations can delete data. Starting the current application applies its pending migrations again, so deploy the matching application version after a rollback.

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

Batches contain 1–1000 events and at most 2 MB of JSON. Retry the same payload with the same request/event IDs after transport errors or 5xx/429 responses. Reusing an ID with different content returns 409 and rolls back the batch. Response `{committed, duplicates, rejected, revision}` is sent after commit; `rejected` counts events for archived months, which must be sent to `POST /api/backfill` instead (same key, body and limits; it responds after the archived months are merged into S3). Nested JSON values retain their types. Sending a session and person together links historical anonymous events; a session cannot be reassigned to a different person. Person properties use event timestamp, then event ID, to resolve ties deterministically.

```ts
import { createClient } from '@quacklytics/client'

const client = createClient({
  hostname: 'https://analytics.example.com',
  apiKey: 'your-project-key',
  autoTrackPageviews: false,
})
await client.send({ eventType: 'signup', properties: { plan: 'pro' } })
```

The first-party browser SDK now provides consent-gated SPA pageviews, safe opt-in autocapture, anonymous/session identity, identify/reset, bounded batching, retry/backoff, per-tab reload recovery, and flush/destroy. See [the client guide](packages/tracker/README.md) for its APIs and delivery guarantees. The landing page is the E2E client in `tests/e2e/tracker-landing.spec.ts`; run `bun run build` then `bunx playwright test tests/e2e/tracker-landing.spec.ts` with development storage running.

New projects start with the **Web analytics** dashboard, built on SDK pageviews: visitors, pageviews and sessions, a trend, a world map of visitor countries, top pages, referrers, custom events, devices, browsers and operating systems. Apply the template to an empty dashboard to get it again; existing dashboards are left unchanged.

The service accepts both the original first-party importer payload above and the new versioned SDK operations envelope. Migration `0003_sdk_identity` adds anonymous-user links without rewriting old event fingerprints or legacy actor IDs. Ingestion is limited to 600 requests per project per minute by default (`INGEST_REQUESTS_PER_MINUTE`), returning 429 and Retry-After when exceeded. Admission windows reset when the backend worker restarts.

The tracker creates stable IDs and retries transient failures without duplicating committed events. Browser ingestion requires its exact origin (or `*`) in the project's allowed origins; server-to-server ingestion requires the key. Administrative endpoints require the administrator's session cookie.

See [AGENTS.md](AGENTS.md) for the E2E-first testing policy.

## Development demo data

Generate realistic SDK traffic for Orbit, a fictional product, through your local ingestion endpoint: website and app pageviews, autocaptured clicks, identified users and custom events.

```sh
QUACKLYTICS_API_KEY=your-local-key bun run seed:dev
```

To create a new demo project with all six chart types already configured, supply your existing local admin credentials:

```sh
QUACKLYTICS_PASSWORD=your-local-password bun run seed:dev --email you@example.com
```

Defaults are 250 sign-ups, 2,500 other website visitors and 365 days of history (roughly 380 events per day). Run `bun run seed:dev --help` for options and see [the demo guide](scripts/demo/README.md) for event names and chart recipes. Each run adds a fresh dataset.

### DuckDB WASM range-read patch

DuckDB-WASM is pinned to `1.32.0`, the latest stable version published on npm.

`patches/@duckdb%2Fduckdb-wasm@1.32.0.patch` fixes the MVP worker's signed-URL range probe to read `Content-Range` instead of splitting `Content-Length` ([upstream issue #2228](https://github.com/duckdb/duckdb-wasm/issues/2228)). Bun applies it on install. Browser E2E coverage verifies HTTP 206 reads directly from Garage; keep that assertion when upgrading DuckDB.
