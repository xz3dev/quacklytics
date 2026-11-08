import { format } from "date-fns";
import { Bot, Unplug } from "lucide-react";
import { toast } from "sonner";
import { CodeSnippet } from "@/components/code-snippet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgentAccess, useDisconnectAgent } from "@/services/agents";

type Agent = {
  clientId: string;
  name: string | null;
  redirectTargets: string[];
  connectedAt: number;
};

/**
 * Read-only access for AI agents to every project. Agents sign in with OAuth:
 * the user approves each one in the browser and can disconnect it here.
 */
export function AgentAccess() {
  const access = useAgentAccess();
  return (
    <section
      aria-labelledby="agent-access-heading"
      className="mt-12 space-y-5 rounded-xl border border-border/50 bg-card p-5"
    >
      <div className="space-y-1">
        <h2 id="agent-access-heading" className="text-lg font-semibold">
          Agent access (MCP)
        </h2>
        <p className="text-sm text-muted-foreground">
          Lets AI agents like Claude Code or Codex query the events, schema,
          saved insights and dashboards of all your projects. Each agent signs
          in through this site and needs your approval.
        </p>
      </div>
      {access.isPending ? (
        <p className="text-sm text-muted-foreground">Loading agent access…</p>
      ) : access.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Unable to load agent access. {access.error.message}
        </p>
      ) : access.data.endpoint === null ? (
        <p role="alert" className="text-sm text-muted-foreground">
          Agents can only sign in over HTTPS. Set <code>APP_ORIGIN</code> to
          this instance&apos;s HTTPS address to turn on agent access.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium">Endpoint</p>
            <CodeSnippet label="endpoint">{access.data.endpoint}</CodeSnippet>
          </div>
          <ConnectAgent endpoint={access.data.endpoint} />
          <ConnectedAgents agents={access.data.agents} />
        </>
      )}
    </section>
  );
}

function ConnectAgent({ endpoint }: { endpoint: string }) {
  return (
    <Tabs defaultValue="claude" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Connect an agent</p>
        <TabsList>
          <TabsTrigger value="claude">Claude Code</TabsTrigger>
          <TabsTrigger value="codex">Codex</TabsTrigger>
          <TabsTrigger value="other">Other</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="claude" className="space-y-2">
        <p className="text-xs text-muted-foreground">Run in a terminal:</p>
        <CodeSnippet label="Claude Code command">
          {`claude mcp add --transport http quacklytics ${endpoint}`}
        </CodeSnippet>
        <p className="text-xs text-muted-foreground">
          Then run <code>/mcp</code> in Claude Code, select quacklytics and
          choose Authenticate.
        </p>
      </TabsContent>
      <TabsContent value="codex" className="space-y-2">
        <p className="text-xs text-muted-foreground">Run in a terminal:</p>
        <CodeSnippet label="Codex commands">
          {`codex mcp add quacklytics --url ${endpoint}
codex mcp login quacklytics`}
        </CodeSnippet>
      </TabsContent>
      <TabsContent value="other" className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Add the endpoint as a Streamable HTTP server in any MCP client that
          supports OAuth. The client opens this site so you can sign in and
          approve it.
        </p>
      </TabsContent>
    </Tabs>
  );
}

function ConnectedAgents({ agents }: { agents: Agent[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Connected agents</p>
      {agents.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No agents connected.
        </p>
      ) : (
        <ul className="space-y-2">
          {agents.map((agent) => (
            <AgentRow key={agent.clientId} agent={agent} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AgentRow({ agent }: { agent: Agent }) {
  const disconnect = useDisconnectAgent();
  const name = agent.name?.trim() || "Unnamed agent";
  const confirmAndDisconnect = () => {
    if (
      !window.confirm(
        `Disconnect ${name}? It loses access immediately and has to ask for approval again.`,
      )
    )
      return;
    disconnect.mutate(agent.clientId, {
      onError: (failure) =>
        toast.error("Failed to disconnect agent", {
          description: failure.message,
        }),
    });
  };
  return (
    <li className="flex items-center gap-3 rounded-md border px-3 py-2">
      <Bot className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[
            ...agent.redirectTargets,
            `connected ${format(new Date(agent.connectedAt), "PP")}`,
          ].join(" · ")}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Disconnect ${name}`}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        disabled={disconnect.isPending}
        onClick={confirmAndDisconnect}
      >
        <Unplug />
        Disconnect
      </Button>
    </li>
  );
}
