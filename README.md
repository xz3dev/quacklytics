# Quacklytics 🦆

Self-hosted product and web analytics. Your server stores events; analytical queries run in the browser.

- **Collect** events with the `@quacklytics/client` browser SDK (consent-gated pageviews, opt-in autocapture, identify/reset, retries without duplicates) or a plain HTTP API.
- **Analyze** with insights and dashboards. New projects start with a **Web analytics** dashboard: visitors, pageviews, sessions, a trend, a world map, top pages, referrers, custom events, devices, browsers and operating systems.
- **Own your data**: everything lives in SQLite on your server and Parquet files in your own S3-compatible bucket.

## How it works

- Ingested events are committed to a per-project SQLite database before the request is acknowledged.
- Once a day, completed days are exported as monthly ZSTD Parquet files to your private S3 bucket.
- The browser loads DuckDB-WASM and queries a single `events` view that combines the Parquet files (read directly from S3 via signed URLs) with recent events from SQLite. Data refreshes every 15 seconds while the tab is visible.
- Seven days after a month ends, and once its Parquet file is verified, that month is **archived**: its rows are deleted from SQLite and it exists only in S3.

## Quick start

Requires Docker.

```sh
git clone https://github.com/xz3dev/quacklytics.git
cd quacklytics
docker compose up --build
```

This starts the app together with [Garage](https://garagehq.deuxfleurs.fr/) as a local S3 bucket. Open `http://localhost:3000`, register the first administrator (registration closes afterwards), then create a project. Project settings show the ingestion key and the allowed browser origins.

The bundled credentials are public and only suitable for trying it out locally.

## Sending events

### Browser SDK

```sh
npm install @quacklytics/client
```

```ts
import { createClient } from '@quacklytics/client'

const client = createClient({
  hostname: 'https://analytics.example.com',
  apiKey: 'your-project-key',
})
await client.send({ eventType: 'signup', properties: { plan: 'pro' } })
```

Add your site's origin (or `*`) to the project's allowed origins. See [the client guide](packages/tracker/README.md) for pageviews, autocapture, consent, identity and delivery guarantees.

### HTTP API

`POST /api/ingest` with `Content-Type: application/json` and `X-API-KEY: <project key>`:

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

- Batches contain 1–1000 events and at most 2 MB of JSON.
- After transport errors, 5xx or 429 responses, retry the same payload with the same request and event IDs. Reusing an ID with different content returns 409 and rolls back the batch.
- The response `{committed, duplicates, rejected, revision}` is sent after commit. `rejected` counts events for archived months; send those to `POST /api/backfill` instead (same key, body and limits).
- Sending a session and person together links that session's earlier anonymous events to the person.

## Deploying

The image is published as `ghcr.io/xz3dev/quacklytics` (`latest`, `X.Y.Z`, `X.Y`, or `nightly`). Pending database migrations are applied automatically on startup.

### Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_ORIGIN` | `http://127.0.0.1:3000` | Exact public origin of the app, used for authentication |
| `DATA_DIR` | `./data` relative to `apps/web` | Durable SQLite and auth directory |
| `S3_ENDPOINT` | Required | S3-compatible endpoint used by the server |
| `S3_PUBLIC_ENDPOINT` | `S3_ENDPOINT` | Browser-reachable endpoint used when signing URLs |
| `S3_REGION` | Required | Bucket region |
| `S3_BUCKET` | Required | Private bucket for Parquet files |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Required | Server-only credentials with list, read, write and delete access. If any S3 variable is missing, the UI loads but every API request returns 503 |
| `PORT` | `3000` | Listen port |
| `HOST` | `0.0.0.0` | Bind address |
| `TRUSTED_PROXIES` | None | Comma-separated IPs/CIDRs of your reverse proxies, or the presets `loopback` and `private`. Required behind a proxy so visitors and auth rate limits use the real client address |
| `AUTH_SECRET` | Generated and stored in `DATA_DIR/auth-secret` | Optional stable authentication secret |
| `INGEST_REQUESTS_PER_MINUTE` | `600` | Ingestion requests allowed per project per minute; excess requests get 429 with `Retry-After` |

### Checklist

- **S3 bucket:** use a private bucket. Configure CORS to allow your app origin with `GET`/`HEAD` and `Range`, and expose `Content-Range`, `Content-Length`, `Accept-Ranges`, `ETag` and `Last-Modified` (see [`dev/cors.json`](dev/cors.json)). `S3_PUBLIC_ENDPOINT` must be reachable by your users, over HTTPS if the app is served over HTTPS.
- **Reverse proxy:** set `APP_ORIGIN` to your external HTTPS origin and `TRUSTED_PROXIES` to the proxy's address (for example `private` when it reaches the app over a Docker network). `GET /api/proxy-check` reports whether this matches, and the app shows a hint when it doesn't.
- **Storage:** run one app process per data directory, on a local filesystem.
- **Backups:** stop the service and copy the whole data directory, including the auth secret and SQLite WAL files. **Back up the S3 bucket too: archived months exist only there.**
- **Changing buckets:** SQLite events are re-exported to a new endpoint or bucket only while no month has been archived. Afterwards, changing the destination makes exports fail until the previous one is restored.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development, testing, architecture and releases.

## License

[MIT](LICENSE)
