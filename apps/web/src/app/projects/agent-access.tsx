import { useState } from "react";
import { format } from "date-fns";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CodeSnippet } from "@/components/code-snippet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useCreateMcpToken,
  useDeleteMcpToken,
  useMcpTokenSecret,
  useMcpTokens,
} from "@/services/mcp-tokens";

type Token = { id: number; prefix: string; createdAt: number };

/** Read-only access for AI agents to every project, tied to the signed-in user. */
export function AgentAccess() {
  const tokens = useMcpTokens();
  const createMutation = useCreateMcpToken();
  // One token is shown at a time, starting with a newly created one; the
  // setup instructions use it.
  const [shownId, setShownId] = useState<number>();
  const shown = useMcpTokenSecret(shownId ?? 0, shownId !== undefined);
  const shownToken = shownId === undefined ? undefined : shown.data?.token;
  const endpoint = `${window.location.origin}/api/mcp`;

  const create = () =>
    createMutation.mutate(undefined, {
      onSuccess: ({ id }) => setShownId(id),
      onError: (error) =>
        toast.error("Failed to create access token", {
          description: error.message,
        }),
    });

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
          saved insights and dashboards of all your projects. Treat tokens like
          passwords.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Endpoint</p>
        <CodeSnippet label="endpoint">{endpoint}</CodeSnippet>
      </div>
      <ConnectAgent endpoint={endpoint} token={shownToken} />
      <div className="space-y-3">
        <Button
          className="w-full"
          disabled={createMutation.isPending}
          onClick={create}
        >
          <Plus />
          Create access token
        </Button>
        {tokens.isPending ? (
          <p className="text-sm text-muted-foreground">
            Loading access tokens…
          </p>
        ) : tokens.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Unable to load access tokens. {tokens.error.message}
          </p>
        ) : tokens.data.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No access tokens.
          </p>
        ) : (
          <TooltipProvider delayDuration={300}>
            <ul className="space-y-2">
              {tokens.data.map((token) => (
                <TokenRow
                  key={token.id}
                  token={token}
                  shown={shownId === token.id}
                  secret={shownId === token.id ? shownToken : undefined}
                  loading={shownId === token.id && shown.isFetching}
                  error={
                    shownId === token.id ? shown.error?.message : undefined
                  }
                  onShownChange={(isShown) =>
                    setShownId(isShown ? token.id : undefined)
                  }
                />
              ))}
            </ul>
          </TooltipProvider>
        )}
      </div>
    </section>
  );
}

function TokenRow({
  token,
  shown,
  secret,
  loading,
  error,
  onShownChange,
}: {
  token: Token;
  shown: boolean;
  secret: string | undefined;
  loading: boolean;
  error: string | undefined;
  onShownChange: (shown: boolean) => void;
}) {
  const deleteMutation = useDeleteMcpToken();

  const revoke = () => {
    if (!window.confirm("Revoke this MCP access token?")) return;
    deleteMutation.mutate(token.id, {
      onSuccess: () => {
        if (shown) onShownChange(false);
      },
      onError: (failure) =>
        toast.error("Failed to revoke access token", {
          description: failure.message,
        }),
    });
  };

  return (
    <li className="space-y-1">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="min-w-0 flex-1">
              {secret ? (
                <CodeSnippet label="access token">{secret}</CodeSnippet>
              ) : (
                <code className="block truncate rounded-md border bg-muted px-4 py-3 font-mono text-xs text-muted-foreground">
                  {loading ? "Loading…" : `${token.prefix}${"•".repeat(24)}`}
                </code>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Created {format(new Date(token.createdAt), "PP 'at' p")}
          </TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          aria-label={shown ? "Hide access token" : "Show access token"}
          onClick={() => onShownChange(!shown)}
        >
          {shown ? <EyeOff /> : <Eye />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Revoke access token"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          disabled={deleteMutation.isPending}
          onClick={revoke}
        >
          <Trash2 />
        </Button>
      </div>
      {error && (
        <p role="alert" className="pl-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

function ConnectAgent({
  endpoint,
  token,
}: {
  endpoint: string;
  token: string | undefined;
}) {
  const bearer = `Bearer ${token ?? "<access token>"}`;
  return (
    <Tabs defaultValue="claude" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Connect an agent</p>
        <TabsList>
          <TabsTrigger value="claude">Claude Code</TabsTrigger>
          <TabsTrigger value="codex">Codex</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="claude" className="space-y-2">
        <p className="text-xs text-muted-foreground">Run in a terminal:</p>
        <CodeSnippet label="Claude Code command">
          {`claude mcp add --transport http quacklytics ${endpoint} --header "Authorization: ${bearer}"`}
        </CodeSnippet>
      </TabsContent>
      <TabsContent value="codex" className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Add to <code>~/.codex/config.toml</code>:
        </p>
        <CodeSnippet label="Codex configuration">
          {`[mcp_servers.quacklytics]
url = "${endpoint}"
http_headers = { Authorization = "${bearer}" }`}
        </CodeSnippet>
      </TabsContent>
      {token && (
        <p className="text-xs text-muted-foreground">
          Uses access token <code>{token.slice(0, 12)}…</code>
        </p>
      )}
    </Tabs>
  );
}
