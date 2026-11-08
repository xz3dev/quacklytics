import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import {
  createDpopReplayStore,
  createInsufficientScopeError,
  enforceDpopBinding,
  isDpopBindingError,
  parseAccessTokenAuthorization,
} from "better-auth/oauth2";
import { mcp } from "@better-auth/mcp";
import { getOAuthProviderApi } from "@better-auth/oauth-provider";
import { z } from "zod";

/** Read access to every project's events, schema, insights and dashboards. */
export const MCP_READ_SCOPE = "mcp:read";
// offline_access lets agents refresh their access token instead of signing in
// again every hour. MCP clients request what the 401 challenge advertises.
export const MCP_SCOPES = [MCP_READ_SCOPE, "offline_access"];
export const MCP_PATH = "/api/mcp";

/**
 * The MCP resource identifier for an app origin, or undefined when agents
 * cannot sign in there: OAuth for MCP requires HTTPS, except on loopback hosts
 * during local use.
 */
export function mcpResourceFor(origin: string) {
  const url = new URL(origin);
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127(\.\d{1,3}){3}$/.test(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    return undefined;
  return new URL(MCP_PATH, url).href;
}

const invalidToken = (description: string) =>
  new APIError("UNAUTHORIZED", {
    message: description,
    error: "invalid_token",
    error_description: description,
  });

/**
 * Better Auth plugins that make this app the OAuth authorization server for
 * its own MCP endpoint, plus the check the endpoint runs on every request.
 */
export function mcpOAuthPlugins(resource: string) {
  const provider = mcp({
    resource,
    loginPage: "/login",
    consentPage: "/oauth/consent",
    // Opaque access tokens are looked up in the database on every request, so
    // disconnecting an agent rejects its next request. No signing keys exist.
    disableJwtPlugin: true,
    scopes: MCP_SCOPES,
    grantTypes: ["authorization_code", "refresh_token"],
    // MCP clients refresh from several requests at once with the same refresh
    // token. Agent requests are serialized (see http.ts), so a duplicate that
    // arrives within this many seconds gets the rotation's response instead
    // of revoking it. mcp() defaults to 30; plain oauthProvider() to 0.
    refreshTokenReuseInterval: 30,
    // Agents register themselves (RFC 7591). The login and consent pages are
    // what grants access, so registration itself needs no credentials.
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    clientRegistrationDefaultScopes: MCP_SCOPES,
    // Desktop agents receive the code on a loopback or custom-scheme redirect.
    clientRegistrationDefaultApplicationType: "infer",
  });
  const resourceServer = {
    id: "quacklytics-mcp-resource-server",
    endpoints: {
      /**
       * Validates the access token of an MCP request with the provider's own
       * token lookup: it must be active, issued for this MCP server, carry the
       * read scope, belong to a connected agent and, when DPoP-bound, come
       * with a matching proof.
       */
      authorizeMcpRequest: createAuthEndpoint(
        "/mcp/authorize-request",
        {
          method: "POST",
          body: z.object({
            authorization: z.string().nullable(),
            dpop: z.string().nullable(),
            method: z.string(),
          }),
          metadata: { SERVER_ONLY: true },
        },
        async (ctx) => {
          const authorization = parseAccessTokenAuthorization(
            ctx.body.authorization,
          );
          if (!authorization || authorization.scheme === "Unknown")
            throw new APIError("UNAUTHORIZED", {
              message: "An OAuth access token is required",
            });
          const claims = await getOAuthProviderApi(
            ctx,
            provider.options,
          ).requireActiveAccessToken(authorization.token);
          const audience =
            claims.aud === undefined
              ? []
              : Array.isArray(claims.aud)
                ? claims.aud
                : [claims.aud];
          if (!audience.includes(resource))
            throw invalidToken("Access token was not issued for this server");
          const scopes =
            typeof claims.scope === "string" ? claims.scope.split(" ") : [];
          if (!scopes.includes(MCP_READ_SCOPE))
            throw createInsufficientScopeError([MCP_READ_SCOPE]);
          if (
            typeof claims.sub !== "string" ||
            typeof claims.client_id !== "string"
          )
            throw invalidToken("Access token has no user or client");
          // Disconnecting an agent deletes its consent. Tokens issued without
          // one, e.g. from a code redeemed afterwards, grant nothing.
          const consent = z
            .object({ scopes: z.array(z.string()) })
            .nullable()
            .parse(
              await ctx.context.adapter.findOne({
                model: "oauthConsent",
                where: [
                  { field: "clientId", value: claims.client_id },
                  { field: "userId", value: claims.sub },
                ],
              }),
            );
          if (!consent?.scopes.includes(MCP_READ_SCOPE))
            throw invalidToken("The agent is no longer connected");
          try {
            await enforceDpopBinding({
              payload: claims,
              authorization,
              proofJwt: ctx.body.dpop,
              method: ctx.body.method,
              // Behind a proxy the request URL is internal; proofs name the public one.
              url: resource,
              replayStore: createDpopReplayStore(ctx.context.internalAdapter),
            });
          } catch (error) {
            if (isDpopBindingError(error))
              throw new APIError("UNAUTHORIZED", {
                message: error.message,
                error: error.code,
                error_description: error.message,
              });
            throw error;
          }
          return ctx.json({ userId: claims.sub });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
  return [provider, resourceServer];
}
