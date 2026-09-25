---
title: API Reference
---

Administrative endpoints require the administrator's session cookie. Authentication uses `/api/auth/sign-up/email`, `/api/auth/sign-in/email`, and `/api/auth/sign-out`; only the first account can register.

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/setup` | GET | Whether an administrator exists |
| `/api/health` | GET | Backend readiness |
| `/api/me` | GET | Current administrator |
| `/api/projects` | GET, POST | List/create projects |
| `/api/:project/settings` | POST | Update name and allowed origins |
| `/api/:project/apikeys` | GET, POST | List/create ingestion keys |
| `/api/:project/apikeys/:id` | DELETE | Revoke a key |
| `/api/:project/insights` | GET, POST | List/create typed insights |
| `/api/:project/insights/:id` | GET, PUT, DELETE | Insight CRUD |
| `/api/:project/dashboards` | GET, POST | List/create dashboards |
| `/api/:project/dashboards/:id` | GET, PUT, DELETE | Dashboard CRUD |
| `/api/:project/dashboards/:id/insights` | PUT | Ordered insight IDs |
| `/api/:project/dashboards/:id/home` | PUT | Set project home dashboard |
| `/api/:project/schema` | GET | Observed event fields and JSON types |
| `/api/:project/events` | GET | Up to 10,000 events; optional `timestamp__gt` |
| `/api/:project/events/catalog` | GET | Current Parquet snapshot metadata |
| `/api/:project/events/catalog/gen` | POST | Regenerate snapshot |
| `/api/:project/events/download?file=...` | GET | Authenticated Parquet download |
| `/api/ingest` | POST, OPTIONS | Durable ingestion using `X-API-KEY` |

The source of truth for payload definitions is `packages/contracts/src/index.ts` in the repository. See Sending Data for the ingestion protocol. The historical `/api/event`, dummy-data, repair and realtime-token endpoints have been retired in this pre-deployment migration.
