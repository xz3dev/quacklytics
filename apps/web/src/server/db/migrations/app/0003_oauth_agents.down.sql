-- OAuth grants cannot become user tokens; agents must be given new tokens.
DROP TABLE "oauthAccessToken";
DROP TABLE "oauthRefreshToken";
DROP TABLE "oauthConsent";
DROP TABLE "oauthClientResource";
DROP TABLE "oauthClientAssertion";
DROP TABLE "oauthResource";
DROP TABLE "oauthClient";
CREATE TABLE mcp_tokens(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  digest TEXT NOT NULL UNIQUE,
  secret TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX mcp_tokens_user_id_idx ON mcp_tokens(user_id);
