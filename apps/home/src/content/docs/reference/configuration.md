---
title: Configuration
description: Environment variables for running the Quacklytics server.
sidebar:
  order: 1
---

Quacklytics is configured entirely through environment variables. No config file is needed.

## Required

| Variable | Description |
| --- | --- |
| `S3_ENDPOINT` | S3-compatible endpoint the server uses, for example `https://s3.eu-central-1.amazonaws.com` |
| `S3_REGION` | Bucket region (`garage` for local development) |
| `S3_BUCKET` | Name of the **private** bucket for Parquet files |
| `S3_ACCESS_KEY_ID` | Access key. Only the server uses it. |
| `S3_SECRET_ACCESS_KEY` | Secret key. Only the server uses it. |
| `APP_ORIGIN` | Exact public origin (scheme + host + port), for example `https://analytics.example.com`. Defaults to `http://127.0.0.1:3000`, so every other setup must set it, or sign-in fails. |

:::caution[Missing S3 settings]
If an S3 variable is missing or invalid, the web UI still loads, but every `/api` request returns `503` and the error is logged. In Docker, the container also turns unhealthy. Use the bundled Garage setup (`docker compose up` or `bun run storage:up`) for local development.
:::

## Optional

| Variable | Default | Description |
| --- | --- | --- |
| `S3_PUBLIC_ENDPOINT` | `S3_ENDPOINT` | Endpoint browsers use for signed URLs. Use HTTPS when the app is served over HTTPS, because browsers block mixed content. |
| `TRUSTED_PROXIES` | _none_ | Comma-separated IPs/CIDRs of your reverse proxies, or the presets `loopback` and `private`. |
| `DATA_DIR` | `/data` in Docker; `apps/web/data` from source | Directory for SQLite databases and the auth secret. Must be empty or an existing Quacklytics data directory. |
| `AUTH_SECRET` | Generated into `DATA_DIR/auth-secret` | Stable authentication secret. Changing it signs everyone out. |
| `GEOIP` | `on` | Set to `off` to stop adding `$country` to events and downloading the GeoIP database. |
| `GEOIP_DB_PATH` | _none_ | Country database in MaxMind DB format (for example DB-IP or MaxMind GeoLite2) to use instead of downloading one. It is read at startup and never updated. |
| `INGEST_REQUESTS_PER_MINUTE` | `600` | Ingestion requests allowed per project per minute |
| `PORT` | `3000` | Listen port of the production server. Keep `3000` in Docker, because the health check uses it. |
| `HOST` | `0.0.0.0` | Bind address of the production server |

:::note
`bun run dev` always listens on `http://127.0.0.1:3000` and ignores `PORT` and `HOST`.
:::

:::tip[Behind a reverse proxy]
Set `TRUSTED_PROXIES` (see [Reverse Proxy](/self-hosting/reverse-proxy/)). Only then does the server trust `X-Forwarded-For`, which it needs to tell anonymous visitors apart and to rate-limit sign-in attempts. Without it, every visitor appears to come from your proxy.

After you sign in, the web app checks this and shows a setup guide if requests arrive through a proxy it does not trust, or a trusted proxy that does not send `X-Forwarded-For`.
:::

## Visitor country

Events sent by the browser tracker get a `$country` property, the ISO 3166-1 alpha-2 code (for example `DE`) for the visitor's IP address. The IP itself is never stored. Events that already set `$country` keep their value. Events sent through the plain HTTP API or backfill are not enriched, because their address belongs to the sending server.

By default the server downloads [IP to Country Lite by DB-IP](https://db-ip.com) (CC BY 4.0) into `DATA_DIR/geoip` and checks daily for its monthly update. Until the first download finishes, or if it fails, events are stored without `$country`. Map insights then credit DB-IP with a link, as its licence requires; the credit is hidden when `GEOIP_DB_PATH` points to another database. For offline installs, set `GEOIP_DB_PATH`. Behind a reverse proxy, set `TRUSTED_PROXIES`, or every visitor gets your proxy's country.

## Example

```sh title=".env"
APP_ORIGIN=https://analytics.example.com
TRUSTED_PROXIES=private

S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=quacklytics
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

:::danger[Don't change the bucket casually]
Archived months exist only in S3. Once a project has archived months, changing `S3_ENDPOINT` or `S3_BUCKET` stops its exports and hides all published history from dashboards until you switch back. See [S3 Storage](/self-hosting/s3-storage/#changing-the-bucket).
:::
