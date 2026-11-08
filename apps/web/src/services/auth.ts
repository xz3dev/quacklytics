import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { request, HttpError } from "@/client/api/http";
import { user as userSchema } from "@quacklytics/contracts";
import {
  authorizationFailure,
  continuationUrl,
  signedAuthorization,
} from "@/services/oauth";
export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async ({ signal }) => {
    try {
      return userSchema.parse(await request("GET", "me", undefined, signal));
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) return null;
      throw error;
    }
  },
  staleTime: 30000,
  retry: false,
});
export function useAuth() {
  const client = useQueryClient();
  const session = useQuery(sessionQuery);
  /** Signs in and returns where an agent's authorization continues, if any. */
  async function authenticate(path: string, body: Record<string, unknown>) {
    const oauthQuery = signedAuthorization();
    const response = await request(
      "POST",
      path,
      oauthQuery ? { ...body, oauth_query: oauthQuery } : body,
    ).catch((error: unknown) => {
      throw authorizationFailure(error);
    });
    await client.cancelQueries({ queryKey: sessionQuery.queryKey });
    await client.invalidateQueries({
      queryKey: sessionQuery.queryKey,
      refetchType: "none",
    });
    const user = await client.fetchQuery(sessionQuery);
    if (!user)
      throw new Error(
        "Unable to establish your session. Please sign in again.",
      );
    return continuationUrl(response);
  }
  return {
    user: session.data,
    loading: session.isPending,
    error: session.error,
    retry: () => session.refetch(),
    login: (email: string, password: string) =>
      authenticate("auth/sign-in/email", { email, password }),
    register: (email: string, password: string) =>
      authenticate("auth/sign-up/email", { email, password, name: email }),
    logout: async () => {
      await request("POST", "auth/sign-out", {});
      await client.cancelQueries();
      client.clear();
      window.location.replace("/login");
    },
  };
}
