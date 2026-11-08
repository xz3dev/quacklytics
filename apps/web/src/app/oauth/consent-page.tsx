import { useEffect, useState } from "react";
import { Bot, RefreshCw, Table2 } from "lucide-react";
import {
  Brand,
  BrandBackdrop,
  BrandMark,
  BrandStatus,
} from "@/components/brand";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/services/auth";
import {
  decideConsent,
  signedAuthorization,
  useOAuthClient,
} from "@/services/oauth";

const scopeDescriptions: Record<string, { icon: typeof Table2; text: string }> =
  {
    "mcp:read": {
      icon: Table2,
      text: "Read the events, schema, saved insights and dashboards of all your projects",
    },
    offline_access: {
      icon: RefreshCw,
      text: "Stay connected until you disconnect it on the Projects page",
    },
  };

/** Where the agent receives the outcome, in words a person can check. */
function describeRedirect(uri: string | null) {
  if (!uri) return "an unknown address";
  try {
    const url = new URL(uri);
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      return `an app on this computer (${url.host})`;
    if (url.protocol === "https:" || url.protocol === "http:") return url.host;
    return `the app that opens ${url.protocol} links`;
  } catch {
    return uri;
  }
}

/**
 * Where an agent's authorization asks the signed-in user to approve it. Agents
 * register themselves, so the page shows the self-chosen name next to the
 * address the authorization returns to, which is what the user can verify.
 */
export function ConsentPage() {
  const [oauthQuery] = useState(signedAuthorization);
  const auth = useAuth();
  const params = new URLSearchParams(oauthQuery ?? "");
  const client = useOAuthClient(
    auth.user ? (params.get("client_id") ?? undefined) : undefined,
  );
  const [pending, setPending] = useState<"allow" | "deny">();
  const [error, setError] = useState("");
  // Without a session, sign in first; the authorization then comes back here.
  const signIn = !auth.loading && !auth.error && !auth.user && oauthQuery;
  useEffect(() => {
    if (signIn) window.location.replace(`/login?${oauthQuery}`);
  }, [signIn, oauthQuery]);

  if (!oauthQuery || !params.get("client_id"))
    return (
      <BrandStatus alert>
        This authorization request is incomplete. Start connecting from your
        agent again.
      </BrandStatus>
    );
  if (auth.error)
    return (
      <BrandStatus alert>
        Unable to verify your session. Reload the page to try again.
      </BrandStatus>
    );
  if (auth.loading || signIn || client.isPending)
    return (
      <BrandStatus>
        <span className="flex items-center gap-2">
          <Spinner size="small" />
          Loading authorization…
        </span>
      </BrandStatus>
    );
  if (client.isError)
    return (
      <BrandStatus alert>
        This agent is not registered here. Start connecting from your agent
        again.
      </BrandStatus>
    );

  const name = client.data.client_name?.trim() || "An unnamed agent";
  const scopes = (params.get("scope") ?? "").split(" ").filter(Boolean);
  const decide = async (accept: boolean) => {
    setError("");
    setPending(accept ? "allow" : "deny");
    try {
      await decideConsent(accept, oauthQuery);
    } catch (failure) {
      setPending(undefined);
      setError(
        failure instanceof Error
          ? failure.message
          : "The authorization could not be completed.",
      );
    }
  };

  return (
    <div className="relative isolate flex min-h-dvh flex-col bg-background">
      <BrandBackdrop />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-xs">
              <BrandMark className="size-8" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Connect an agent
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Signed in as {auth.user?.email}
            </p>
          </div>
          <section
            aria-labelledby="consent-agent"
            className="space-y-5 rounded-xl border border-border/50 bg-card p-6 shadow-xs"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted">
                <Bot className="size-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <h2
                  id="consent-agent"
                  className="break-words font-semibold leading-tight"
                >
                  {name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  The agent chose this name itself. Allow it only if you just
                  started connecting it.
                </p>
              </div>
            </div>
            <dl className="space-y-1 text-sm">
              <dt className="text-muted-foreground">Access goes to</dt>
              <dd className="break-all font-medium">
                {describeRedirect(params.get("redirect_uri"))}
              </dd>
            </dl>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">It will be able to</p>
              <ul className="space-y-2">
                {scopes.map((scope) => {
                  const known = scopeDescriptions[scope];
                  const Icon = known?.icon ?? Table2;
                  return (
                    <li key={scope} className="flex items-start gap-2">
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{known?.text ?? scope}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:text-red-400"
              >
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending !== undefined}
                onClick={() => void decide(false)}
              >
                {pending === "deny" ? "Denying…" : "Deny"}
              </Button>
              <Button
                className="flex-1"
                disabled={pending !== undefined}
                onClick={() => void decide(true)}
              >
                {pending === "allow" ? "Allowing…" : "Allow access"}
              </Button>
            </div>
          </section>
        </div>
      </main>
      <footer className="flex justify-center pb-8 text-muted-foreground">
        <Brand className="text-xs font-medium opacity-70 [&_img]:size-4" />
      </footer>
    </div>
  );
}
