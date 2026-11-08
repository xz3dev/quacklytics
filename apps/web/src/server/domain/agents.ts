import { z } from "zod";
import { appDb } from "../db/database";
import { RequestError } from "../errors";

// Better Auth stores string arrays as JSON text and dates as ISO strings.
const stringList = z
  .string()
  .transform((text): unknown => JSON.parse(text))
  .pipe(z.array(z.string()));
const consentRow = z.object({
  clientId: z.string(),
  name: z.string().nullable(),
  redirectUris: stringList,
  scopes: stringList,
  createdAt: z.string(),
});

// Where an agent receives its authorization: a loopback port for desktop
// agents, a custom scheme for editors, or a website.
function redirectTarget(uri: string) {
  try {
    const url = new URL(uri);
    return url.host ? url.host : url.protocol.replace(/:$/, "");
  } catch {
    return uri;
  }
}

/** Agents the user approved, with what they may read. */
export function listConnectedAgents(userId: string) {
  return z
    .array(consentRow)
    .parse(
      appDb
        .query(
          `SELECT c."clientId" AS clientId, c."name" AS name, c."redirectUris" AS redirectUris,
             k."scopes" AS scopes, k."createdAt" AS createdAt
           FROM "oauthConsent" k JOIN "oauthClient" c ON c."clientId" = k."clientId"
           WHERE k."userId" = ? ORDER BY k."createdAt", c."clientId"`,
        )
        .all(userId),
    )
    .map((row) => ({
      clientId: row.clientId,
      name: row.name,
      redirectTargets: [...new Set(row.redirectUris.map(redirectTarget))],
      scopes: row.scopes,
      connectedAt: Date.parse(row.createdAt),
    }));
}

/**
 * Withdraws an agent's access: its tokens stop working on their next use,
 * codes it has not redeemed yet become invalid, and it has to ask for consent
 * again.
 */
export function disconnectAgent(userId: string, clientId: string) {
  const removed = appDb
    .transaction(
      () =>
        // Authorization codes are Better Auth verification rows holding JSON.
        appDb
          .query(
            `DELETE FROM "verification" WHERE CASE WHEN json_valid("value") THEN
               json_extract("value", '$.type') = 'authorization_code'
               AND json_extract("value", '$.query.client_id') = ?
               AND json_extract("value", '$.userId') = ? ELSE 0 END`,
          )
          .run(clientId, userId).changes +
        appDb
          .query(
            `DELETE FROM "oauthAccessToken" WHERE "clientId" = ? AND "userId" = ?`,
          )
          .run(clientId, userId).changes +
        appDb
          .query(
            `DELETE FROM "oauthRefreshToken" WHERE "clientId" = ? AND "userId" = ?`,
          )
          .run(clientId, userId).changes +
        appDb
          .query(
            `DELETE FROM "oauthConsent" WHERE "clientId" = ? AND "userId" = ?`,
          )
          .run(clientId, userId).changes,
    )
    .immediate();
  if (!removed) throw new RequestError(404, "Agent not found");
}

// Sign-in requests expire after 10 minutes, so a registration without consent
// an hour later was abandoned.
const ABANDONED_AFTER_MS = 60 * 60 * 1000;

/**
 * Deletes what expired and agent registrations that hold no consent or token
 * an hour after they were made. Registration needs no credentials, so this
 * keeps abandoned and unwanted registrations from piling up.
 */
export function pruneAgentAuthorizations(now = Date.now()) {
  const expired = new Date(now).toISOString();
  const abandoned = new Date(now - ABANDONED_AFTER_MS).toISOString();
  appDb
    .transaction(() => {
      // Better Auth keeps expired browser sessions until their cookie returns.
      // Agent tokens remember the session they were approved in and stop
      // working once it expires; deleting it detaches them, as signing out does.
      appDb.query(`DELETE FROM "session" WHERE "expiresAt" < ?`).run(expired);
      // Authorization codes and DPoP proof reservations also stay after expiry.
      appDb
        .query(`DELETE FROM "verification" WHERE "expiresAt" < ?`)
        .run(expired);
      appDb
        .query(`DELETE FROM "oauthAccessToken" WHERE "expiresAt" < ?`)
        .run(expired);
      // Rotated refresh tokens stay until they expire so their reuse is detected.
      appDb
        .query(
          `DELETE FROM "oauthRefreshToken" WHERE "expiresAt" < ? AND "id" NOT IN
             (SELECT "refreshId" FROM "oauthAccessToken" WHERE "refreshId" IS NOT NULL)`,
        )
        .run(expired);
      appDb
        .query(
          `DELETE FROM "oauthClient" WHERE "createdAt" < ?
             AND NOT EXISTS (SELECT 1 FROM "oauthConsent" k WHERE k."clientId" = "oauthClient"."clientId")
             AND NOT EXISTS (SELECT 1 FROM "oauthRefreshToken" r WHERE r."clientId" = "oauthClient"."clientId")
             AND NOT EXISTS (SELECT 1 FROM "oauthAccessToken" a WHERE a."clientId" = "oauthClient"."clientId")`,
        )
        .run(abandoned);
    })
    .immediate();
}
