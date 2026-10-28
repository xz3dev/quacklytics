CREATE TABLE projects(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'ready'
);
CREATE TABLE api_keys(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL REFERENCES projects(id),
  digest TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE api_key_secrets(
  id INTEGER PRIMARY KEY REFERENCES api_keys(id) ON DELETE CASCADE,
  value TEXT NOT NULL
);
-- Read access for analytics agents. Unlike ingestion keys these are secret, so
-- only their digest is stored and the full value is shown once on creation.
CREATE TABLE mcp_tokens(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL REFERENCES projects(id),
  digest TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE anonymous_salts(day TEXT PRIMARY KEY, salt BLOB NOT NULL);

-- Better Auth tables, as its schema generator emits them.
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null);
create table "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);
create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);
create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);
create index "session_userId_idx" on "session" ("userId");
create index "account_userId_idx" on "account" ("userId");
create index "verification_identifier_idx" on "verification" ("identifier");
-- A unique index on a constant admits a single administrator.
CREATE UNIQUE INDEX single_admin ON user ((1));
