---
title: Running with Docker
---

Clone the repository and run `docker compose up --build`. Open `http://localhost:3000` and register the first administrator. Registration then closes.

The Compose file builds the TypeScript/Bun application and mounts a persistent `/data` volume. Set `APP_ORIGIN` to the exact public origin when using a reverse proxy. The default is `http://localhost:3000` in Compose. No `application.conf` is needed.

Use a new empty data directory for the TypeScript version; old Go databases and account credentials are not imported. Stop the service before copying the complete volume for a backup. Keep the auth secret and SQLite WAL files together with the databases.

For development without Docker, install Bun 1.3.4, run `bun install --frozen-lockfile` and `bun run dev` from the repository root. Open `http://127.0.0.1:3000`.
