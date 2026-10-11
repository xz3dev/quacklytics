import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { CodeSnippet } from "@/components/code-snippet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { originError } from "@/lib/origins";
import type { Project } from "@/model/project";
import { useUpdateProjectCorsOrigins } from "@/services/projects";

/**
 * How to send events to a project. `originStep` replaces the inline origin
 * editor where the page already has one.
 */
export function SendData({
  project,
  apiKey,
  host,
  originStep,
}: {
  project: Project;
  apiKey: string;
  host: string;
  originStep?: ReactNode;
}) {
  return (
    <Tabs defaultValue="browser">
      <TabsList>
        <TabsTrigger value="browser">Browser SDK</TabsTrigger>
        <TabsTrigger value="server">Server SDK</TabsTrigger>
        <TabsTrigger value="http">HTTP</TabsTrigger>
      </TabsList>
      <TabsContent value="browser">
        <CodeSteps>
          <CodeStep n={1} title="Allow your website's origin">
            {originStep ?? (
              <>
                <OriginField project={project} />
                <p className="text-xs">
                  Using <code>*</code> allows all origins. You can change this
                  later.
                </p>
              </>
            )}
          </CodeStep>
          <CodeStep n={2} title="Initialize the client">
            <CodeSnippet>{`npm i @quacklytics/client`}</CodeSnippet>
            <CodeSnippet>{`import { createClient } from "@quacklytics/client";
import { createCookieConsent } from "@quacklytics/client/consent";

const client = createClient({
  hostname: "${host}",
  apiKey: "${apiKey}",
});

createCookieConsent({ client }).showBanner();`}</CodeSnippet>
          </CodeStep>
          <CodeStep n={3} title="Open your site and accept the banner">
            <p>Pageviews are tracked automatically. To send a custom event:</p>
            <CodeSnippet>{`await client.track("signup", { plan: "pro" });`}</CodeSnippet>
          </CodeStep>
        </CodeSteps>
      </TabsContent>
      <TabsContent value="server">
        <CodeSteps>
          <CodeStep n={1} title="Initialize the server client">
            <CodeSnippet>{`npm i @quacklytics/client`}</CodeSnippet>
            <CodeSnippet>{`import { createServerClient } from "@quacklytics/client/server";

const client = createServerClient({
  hostname: "${host}",
  apiKey: "${apiKey}",
});`}</CodeSnippet>
          </CodeStep>
          <CodeStep n={2} title="Send an event">
            <p>
              Events are batched; <code>flush()</code> sends them right away.
            </p>
            <CodeSnippet>{`await client.track("signup", { plan: "pro" }, { userId: "user-42" });
await client.flush();`}</CodeSnippet>
          </CodeStep>
        </CodeSteps>
      </TabsContent>
      <TabsContent value="http">
        <CodeSteps>
          <CodeStep n={1} title="Send a test event from your terminal">
            <p>
              Each request needs a new <code>requestId</code> (UUID). Each event
              needs an <code>id</code> (UUID) and a <code>timestamp</code> (ISO
              8601 with a timezone, such as <code>2026-01-31T09:30:00Z</code>).
            </p>
            <CurlSnippet host={host} apiKey={apiKey} />
          </CodeStep>
        </CodeSteps>
      </TabsContent>
    </Tabs>
  );
}

// Shell substitutions give every run fresh IDs and the current time, so the
// snippet can be rerun after fixing something.
function CurlSnippet({ host, apiKey }: { host: string; apiKey: string }) {
  return (
    <CodeSnippet>{`curl -X POST ${host}/api/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "requestId": "'"$(uuidgen)"'",
    "events": [{
      "id": "'"$(uuidgen)"'",
      "eventType": "setup_test",
      "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
      "personId": "user:setup-test",
      "properties": { "source": "setup" }
    }]
  }'`}</CodeSnippet>
  );
}

function CodeSteps({ children }: { children: ReactNode }) {
  return <ol className="mt-4 flex flex-col">{children}</ol>;
}

// Steps reveal one after another whenever a tab is opened.
function CodeStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li
      className="group flex gap-4 motion-safe:duration-500 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both"
      style={{ animationDelay: `${(n - 1) * 150}ms` }}
    >
      {/* The line runs through the gap below, joining the next step's number,
          like the docs' steps. */}
      <div className="flex shrink-0 flex-col items-center">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {n}
        </span>
        <span
          aria-hidden
          className="my-2 w-px flex-1 bg-border group-last:hidden"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pb-8 text-sm group-last:pb-0">
        <h3 className="font-medium leading-6">{title}</h3>
        <div className="flex flex-col gap-3 text-muted-foreground">
          {children}
        </div>
      </div>
    </li>
  );
}

export function OriginField({ project }: { project: Project }) {
  const updater = useUpdateProjectCorsOrigins();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const save = async (origins: string[]) => {
    setError("");
    try {
      await updater.mutateAsync({
        projectId: project.id,
        value: JSON.stringify(origins),
      });
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Saving the origin failed.",
      );
      return false;
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {project.corsOrigins.length > 0 && (
        <ul aria-label="Allowed origins" className="flex flex-wrap gap-2">
          {project.corsOrigins.map((origin) => (
            <li
              key={origin}
              className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pl-3 pr-1 font-mono text-xs text-foreground"
            >
              {origin}
              <Button
                variant="ghost"
                size="icon"
                className="size-5 rounded-full"
                aria-label={`Remove ${origin}`}
                disabled={updater.isPending}
                onClick={() => {
                  void save(
                    project.corsOrigins.filter((entry) => entry !== origin),
                  );
                }}
              >
                <X className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const origin = value.trim();
          const invalid = originError(origin, project.corsOrigins);
          if (invalid) return setError(invalid);
          void save([...project.corsOrigins, origin]).then(
            (saved) => saved && setValue(""),
          );
        }}
      >
        <Label htmlFor="setup-origin" className="sr-only">
          Website origin
        </Label>
        <Input
          id="setup-origin"
          className="min-w-0 flex-1 font-mono text-sm"
          placeholder="https://www.example.com"
          value={value}
          disabled={updater.isPending}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={updater.isPending || !value.trim()}
        >
          <Plus />
          Allow
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
