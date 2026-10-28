import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { proxyCheck, type ProxyCheck } from "@quacklytics/contracts";
import { http } from "@/client/api/http";
import { BrandBackdrop } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "@/components/code-snippet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DISMISSED_KEY = "quacklytics:proxy-check-dismissed";
const DOCS_URL = "https://quacklytics.com/reference/configuration/";

export const PROXY_ISSUES: Record<
  Exclude<ProxyCheck["status"], "direct" | "ok">,
  { title: string; body: string }
> = {
  untrusted: {
    title: "Requests reach Quacklytics through an untrusted proxy",
    body: "A reverse proxy forwards the visitor's address in X-Forwarded-For, but the server ignores it until the proxy is listed in TRUSTED_PROXIES. Every visitor currently appears to come from the proxy, which merges anonymous visitors and rate-limits everyone together.",
  },
  partial: {
    title: "Another proxy sits in front of the trusted one",
    body: "The server follows X-Forwarded-For through your trusted proxy, but the next hop is a private address too: probably a second proxy or load balancer. Trust it as well so the real visitor is reached.",
  },
  "missing-header": {
    title: "Your proxy does not forward the visitor's address",
    body: "Requests arrive from a proxy, but without an X-Forwarded-For header. Configure the proxy to send it, otherwise every visitor appears to come from the proxy.",
  },
};

/**
 * Checks once per page load whether the server sees real client addresses,
 * and covers the app with a setup guide when it does not. Signed-in only: the
 * result reveals the proxy's address and the trusted proxy configuration.
 */
export function ProxyCheckGate() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISSED_KEY) === "1");
  }, []);
  const check = useQuery({
    queryKey: ["proxy-check"],
    queryFn: ({ signal }) => http.get("proxy-check", proxyCheck, signal),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const result = check.data;
  if (
    dismissed ||
    !result ||
    result.status === "direct" ||
    result.status === "ok"
  )
    return null;
  return (
    <ProxySetupGuide
      result={result}
      copy={PROXY_ISSUES[result.status]}
      retesting={check.isFetching}
      onRetest={() => {
        void check.refetch();
      }}
      onDismiss={() => {
        sessionStorage.setItem(DISMISSED_KEY, "1");
        setDismissed(true);
      }}
    />
  );
}

function ProxySetupGuide({
  result,
  copy,
  retesting,
  onRetest,
  onDismiss,
}: {
  result: ProxyCheck;
  copy: { title: string; body: string };
  retesting: boolean;
  onRetest: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="proxy-check-title"
      className="fixed inset-0 z-100 isolate overflow-y-auto bg-background"
    >
      <BrandBackdrop />
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <ShieldAlert className="size-5" />
          </div>
          <h1
            id="proxy-check-title"
            className="text-2xl font-semibold tracking-tight"
          >
            {copy.title}
          </h1>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        </header>

        <ProxyFacts result={result} />
        <ProxyFixSteps
          result={result}
          retestHint="Once your address appears above instead of the proxy's, this screen goes away."
        />

        <footer className="flex flex-wrap items-center gap-3">
          <Button onClick={onRetest} disabled={retesting}>
            <RefreshCw className={retesting ? "animate-spin" : undefined} />
            {retesting ? "Retesting…" : "Retest"}
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            Ignore for this session
          </Button>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Configuration docs
          </a>
        </footer>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all font-mono">{children}</dd>
    </>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h3 className="font-medium">{title}</h3>
        {children}
      </div>
    </li>
  );
}

/** The addresses and headers behind a proxy check result. */
export function ProxyFacts({
  result,
  clientLabel = "Your address",
}: {
  result: ProxyCheck;
  clientLabel?: string;
}) {
  return (
    <section className="rounded-lg border bg-card text-sm">
      <h2 className="border-b px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        What the server saw
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-4 py-3">
        <Fact label={clientLabel}>{result.clientIp}</Fact>
        <Fact label="Connection from">{result.socketIp}</Fact>
        <Fact label="X-Forwarded-For">{result.forwardedFor ?? "not sent"}</Fact>
        <Fact label="TRUSTED_PROXIES">
          {result.trustedProxies ?? "not set"}
        </Fact>
      </dl>
    </section>
  );
}

/** How to make the server see real visitor addresses for a failing check. */
export function ProxyFixSteps({
  result,
  retestHint,
}: {
  result: ProxyCheck;
  retestHint: string;
}) {
  return (
    <ol className="flex flex-col gap-6 text-sm">
      {result.suggestion ? (
        <Step n={1} title="Trust your proxy">
          <p className="text-muted-foreground">
            Set this environment variable on the Quacklytics server. Use exact
            addresses or CIDRs if your proxy has a fixed address; the{" "}
            <code>loopback</code> and <code>private</code> presets cover proxies
            on the same host or network.
          </p>
          <Tabs defaultValue="env">
            <TabsList>
              <TabsTrigger value="env">.env</TabsTrigger>
              <TabsTrigger value="compose">Docker Compose</TabsTrigger>
              <TabsTrigger value="docker">docker run</TabsTrigger>
            </TabsList>
            <TabsContent value="env">
              <CodeSnippet>{`TRUSTED_PROXIES=${result.suggestion}`}</CodeSnippet>
            </TabsContent>
            <TabsContent value="compose">
              <CodeSnippet>{`services:\n  quacklytics:\n    environment:\n      TRUSTED_PROXIES: "${result.suggestion}"`}</CodeSnippet>
            </TabsContent>
            <TabsContent value="docker">
              <CodeSnippet>{`docker run -e TRUSTED_PROXIES="${result.suggestion}" …`}</CodeSnippet>
            </TabsContent>
          </Tabs>
        </Step>
      ) : (
        <Step n={1} title="Forward the visitor's address">
          <p className="text-muted-foreground">
            Caddy and Traefik send X-Forwarded-For by default. For nginx, add
            this to the <code>location</code> that proxies to Quacklytics:
          </p>
          <CodeSnippet>{`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`}</CodeSnippet>
          {!result.trustedProxies && (
            <p className="text-muted-foreground">
              Then trust the proxy with{" "}
              <code>TRUSTED_PROXIES={result.socketIp}</code> (or the{" "}
              <code>loopback</code> / <code>private</code> preset).
            </p>
          )}
        </Step>
      )}
      <Step n={2} title="Restart Quacklytics">
        <p className="text-muted-foreground">
          Environment variables are read at startup.
        </p>
      </Step>
      <Step n={3} title="Run the check again">
        <p className="text-muted-foreground">{retestHint}</p>
      </Step>
    </ol>
  );
}
