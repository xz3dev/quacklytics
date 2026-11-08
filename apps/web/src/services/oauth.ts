import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { HttpError, http, request } from "@/client/api/http";

/**
 * An agent's authorization request reaches the login and consent pages as a
 * query string the server signed. Sending it back unchanged with the sign-in
 * or the consent decision continues that authorization.
 */
export function signedAuthorization() {
  const query = window.location.search.slice(1);
  return new URLSearchParams(query).has("sig") ? query : undefined;
}

/** The server rejects an expired or altered authorization request this way. */
export function authorizationFailure(error: unknown) {
  return error instanceof HttpError && error.message === "invalid_signature"
    ? new Error(
        "This approval request has expired or was changed. Start connecting from your agent again.",
      )
    : error;
}

const continuation = z.object({ redirect: z.literal(true), url: z.string() });
// Agents receive the result on http(s) or on their own app's URL scheme.
const unsafeSchemes = new Set(["javascript:", "data:", "vbscript:", "blob:"]);

/** The next step of an authorization, when a sign-in or consent response names one. */
export function continuationUrl(response: unknown) {
  const parsed = continuation.safeParse(response);
  if (!parsed.success) return undefined;
  const url = new URL(parsed.data.url, window.location.origin);
  return unsafeSchemes.has(url.protocol) ? undefined : url.href;
}

/** Approves or denies the agent; either way the agent learns the outcome. */
export async function decideConsent(accept: boolean, oauthQuery: string) {
  const next = continuationUrl(
    await request("POST", "auth/oauth2/consent", {
      accept,
      oauth_query: oauthQuery,
    }).catch((error: unknown) => {
      throw authorizationFailure(error);
    }),
  );
  if (!next) throw new Error("The authorization could not be completed.");
  window.location.assign(next);
}

// Registered by the agent itself, so the name is unverified.
const publicClient = z.object({
  client_id: z.string(),
  client_name: z.string().optional(),
});

export function useOAuthClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["oauthClient", clientId],
    queryFn: ({ signal }) =>
      http.get(
        `auth/oauth2/public-client?client_id=${encodeURIComponent(clientId ?? "")}`,
        publicClient,
        signal,
      ),
    enabled: clientId !== undefined,
    retry: false,
  });
}
