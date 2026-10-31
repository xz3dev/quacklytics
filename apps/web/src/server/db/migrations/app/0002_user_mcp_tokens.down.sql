-- Project-scoped tokens cannot be derived from user tokens; existing ones are dropped.
DROP TABLE mcp_tokens;
CREATE TABLE mcp_tokens(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL REFERENCES projects(id),
  digest TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
