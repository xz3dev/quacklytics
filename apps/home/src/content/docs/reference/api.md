---
title: API Reference
description: Every HTTP endpoint exposed by the Quacklytics server.
sidebar:
  order: 2
---

:::tip[Source of truth]
Request and response payloads are defined as Zod schemas in [`packages/contracts/src/index.ts`](https://github.com/xz3dev/quacklytics/blob/master/packages/contracts/src/index.ts).
:::

## Authentication

There are two kinds of credentials:

| Credential | Used for | How to send it |
| --- | --- | --- |
| **Ingestion key** | `/api/ingest` and `/api/backfill` only | `X-API-KEY` header |
| **Admin session** | Everything else | Session cookie from `/api/auth/sign-in/email` |

Sign in with `/api/auth/sign-in/email`, sign out with `/api/auth/sign-out`. `/api/auth/sign-up/email` only works until the first (and only) administrator exists, then returns `403`. Passwords need at least 12 characters.

:::note
Admin requests that change state (anything except `GET`, `HEAD` and `OPTIONS`) and carry an `Origin` header other than `APP_ORIGIN` are rejected with `403`.
:::

## Ingestion

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/ingest` | POST, OPTIONS | Durable ingestion. Drops events for archived months. See [Sending Data](/guides/send-data/#http-api). |
| `/api/backfill` | POST, OPTIONS | Ingestion that merges into archived months. See [Importing Data](/guides/import/). |

## Public

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/setup` | GET | Whether an administrator exists (`{ adminRegistered }`) |
| `/api/health` | GET | Backend readiness (used by the Docker health check) |
| `/api/proxy-check` | GET | Diagnose `TRUSTED_PROXIES`. See [Reverse Proxy](/self-hosting/reverse-proxy/#check-your-setup). |

## Admin

### Account and projects

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/me` | GET | Current administrator |
| `/api/projects` | GET, POST | List or create projects |
| `/api/:project/settings` | POST | Update name, emoji and allowed origins |
| `/api/:project/apikeys` | GET, POST | List or create ingestion keys |
| `/api/:project/apikeys/:id` | GET, DELETE | Reveal the full key, or revoke it |

### Insights and dashboards

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/:project/insights` | GET, POST | List or create insights |
| `/api/:project/insights/:id` | GET, PUT, DELETE | Read, update or delete an insight |
| `/api/:project/dashboards` | GET, POST | List or create dashboards |
| `/api/:project/dashboards/:id` | GET, PUT, DELETE | Read, update or delete a dashboard |
| `/api/:project/dashboards/:id/insights` | PUT | Set the ordered insight IDs |
| `/api/:project/dashboards/:id/layout` | PUT | Save the card layout |
| `/api/:project/dashboards/:id/home` | PUT | Make this the project's home dashboard |
| `/api/:project/dashboards/default` | POST | Recreate the default dashboard when none exist |
| `/api/:project/dashboards/templates/:template` | POST | Create a dashboard from a template |
| `/api/:project/dashboards/:id/templates/:template` | POST | Apply a template to an empty dashboard |

Available templates: `web_analytics` and `product_analytics` (plus `chart_playground` in development).

### Events and data

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/:project/schema` | GET | Observed event fields and their JSON types |
| `/api/:project/schema/prop/:id` | GET | Known values of one property. `?scope=event` (default) or `project`. |
| `/api/:project/events` | GET | Up to 10,000 events still in the database (not archived). Page with `timestamp__gt`. |
| `/api/:project/events/snapshot` | GET | Signed Parquet URLs plus unpublished SQLite events in one consistent read (gzip when accepted) |
| `/api/:project/events/status` | GET | Publication state: committed/exported revisions, pending exports, last error |
| `/api/:project/events/catalog` | GET | Current Parquet catalog metadata |
| `/api/:project/events/catalog/gen` | POST | Request publication of eligible history to S3 |

## Errors

Errors are returned as JSON with an `error` message. `/api/auth/*` endpoints use their own error format.

```json
{ "error": "Invalid input", "issues": [ ... ] }
```

| Status | Meaning |
| --- | --- |
| `400` | Malformed JSON or invalid input (`issues` lists the validation errors) |
| `401` | Missing or invalid session or ingestion key |
| `403` | Origin not allowed, or registration closed |
| `404` | Unknown route or project |
| `405` | Method not allowed |
| `409` | Conflict: reused request or event ID with different content, identity conflict, template on a non-empty dashboard, … |
| `413` | Request body over 2,000,000 bytes |
| `429` | Ingestion rate limit exceeded. See `Retry-After`. |
| `500` | Internal error (details are logged) |
| `503` | Server overloaded or backend unavailable (for example missing S3 settings). Retry later. |
| `504` | Request took longer than 60 seconds |
