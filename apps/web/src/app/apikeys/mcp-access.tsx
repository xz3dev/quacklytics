import { useState } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CodeSnippet } from "@/components/code-snippet";
import { Button } from "@/components/ui/button";
import { useProjectId } from "@/hooks/use-project-id";
import {
  useCreateMcpToken,
  useDeleteMcpToken,
  useMcpTokens,
} from "@/services/mcp-tokens";

/** Read-only access for AI agents: event data, schema and saved insights. */
export function McpAccess() {
  const projectId = useProjectId();
  const tokens = useMcpTokens(projectId);
  const createMutation = useCreateMcpToken(projectId);
  const deleteMutation = useDeleteMcpToken(projectId);
  // Only digests are stored, so a new secret is shown until it is revoked or the page is left.
  const [created, setCreated] = useState<{ id: number; token: string }>();
  const endpoint = `${window.location.origin}/api/mcp`;

  const create = () =>
    createMutation.mutate(undefined, {
      onSuccess: ({ id, token }) => setCreated({ id, token }),
      onError: (error) =>
        toast.error("Failed to create access token", {
          description: error.message,
        }),
    });
  const revoke = (id: number) => {
    if (!window.confirm("Revoke this MCP access token?")) return;
    deleteMutation.mutate(id, {
      onSuccess: () =>
        setCreated((current) => (current?.id === id ? undefined : current)),
      onError: (error) =>
        toast.error("Failed to revoke access token", {
          description: error.message,
        }),
    });
  };

  return (
    <section
      aria-labelledby="mcp-access-heading"
      className="space-y-4 rounded-xl border border-border/50 bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="mcp-access-heading" className="text-xl font-semibold">
            Agent access (MCP)
          </h2>
          <p className="text-sm text-muted-foreground">
            Lets an AI agent read all events, the schema and saved insights of
            this project. Treat tokens like passwords.
          </p>
        </div>
        <Button disabled={createMutation.isPending} onClick={create}>
          Create access token
        </Button>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Endpoint</p>
        <CodeSnippet label="endpoint">{endpoint}</CodeSnippet>
      </div>
      {created && (
        <div className="space-y-2 rounded-lg border border-primary/40 p-3">
          <p className="text-sm font-medium">
            New access token. Copy it now; it is not shown again.
          </p>
          <CodeSnippet label="access token">{created.token}</CodeSnippet>
          <p className="text-sm text-muted-foreground">Claude Code:</p>
          <CodeSnippet label="command">
            {`claude mcp add --transport http quacklytics ${endpoint} --header "Authorization: Bearer ${created.token}"`}
          </CodeSnippet>
        </div>
      )}
      {tokens.isPending ? (
        <div>Loading access tokens...</div>
      ) : tokens.isError ? (
        <div>Error loading access tokens.</div>
      ) : tokens.data.length === 0 ? (
        <div className="p-4 text-center">No access tokens.</div>
      ) : (
        <ul className="space-y-2">
          {tokens.data.map((token) => (
            <li
              key={token.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 p-3"
            >
              <code className="font-mono text-xs text-muted-foreground">
                {token.prefix}…
              </code>
              <span className="text-xs text-muted-foreground">
                Created {format(new Date(token.createdAt), "PP 'at' p")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                disabled={deleteMutation.isPending}
                onClick={() => revoke(token.id)}
              >
                <Trash2 />
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
