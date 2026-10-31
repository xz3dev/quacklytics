-- MCP tokens belong to the user who created them instead of one project, so a
-- single agent connection can read every project that user can see. The secret
-- is kept so its owner can reveal it again; requests are matched by digest.
DROP TABLE mcp_tokens;
CREATE TABLE mcp_tokens(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  digest TEXT NOT NULL UNIQUE,
  secret TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX mcp_tokens_user_id_idx ON mcp_tokens(user_id);
