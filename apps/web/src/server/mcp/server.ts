import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { appDb } from "../db/database";
import { requireProject } from "../domain/projects";
import { listProjectRecords } from "../repositories/projects";
import { getInsight, listInsights } from "../domain/insights";
import { listDashboards } from "../domain/dashboards";
import { readSchema } from "../domain/schema";
import { requestDataset } from "../exports/client";
import { auth, mcpResource } from "../auth";
import { instructions, queryGuide } from "./guide";
import { MCP_SCOPES } from "./oauth";

// Compact JSON: agents pay for indentation in tokens.
const text = (value: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: typeof value === "string" ? value : JSON.stringify(value),
    },
  ],
});
const readOnly = { readOnlyHint: true, openWorldHint: false };
const projectInput = {
  project: z.string().describe("Project id from list_projects"),
};

// Agents act for the signed-in user; the single administrator sees every project.
function createServer() {
  const server = new McpServer(
    { name: "quacklytics", title: "Quacklytics", version: "1.0.0" },
    { instructions },
  );
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "Lists the projects you can read, one per tracked site or app. Every other tool needs a project id from here; pick the project the question is about, and ask when that is unclear.",
      annotations: readOnly,
    },
    () =>
      text(
        listProjectRecords(appDb, "ready").map(({ id, name }) => ({
          id,
          name,
        })),
      ),
  );
  // Thrown errors such as an unknown project or id become isError results for the model.
  server.registerTool(
    "get_dataset",
    {
      title: "Load event data",
      description:
        "Use it to answer any question about how people use the product: traffic, signups, conversion, retention, feature usage or a specific user's activity. Returns everything needed to query all of the project's events yourself; run its setupSql in DuckDB, then write SQL against `events`. Use the data from one call together, and call again when you need fresher data or the links stop working.",
      inputSchema: projectInput,
      annotations: readOnly,
    },
    async ({ project }) => {
      await requireProject(project);
      return text(await requestDataset(project));
    },
  );
  server.registerTool(
    "get_schema",
    {
      title: "See what is tracked",
      description:
        "Lists every kind of event the product records and the details captured with each. Use it before writing a query to find the right event names and properties, e.g. which event marks a purchase and where the plan or amount is stored.",
      inputSchema: projectInput,
      annotations: readOnly,
    },
    async ({ project }) =>
      text(
        Object.fromEntries(
          Object.entries(readSchema(await requireProject(project))).map(
            ([eventType, fields]) => [
              eventType,
              Object.fromEntries(
                Object.entries(fields).map(([name, field]) => [
                  name,
                  field.type,
                ]),
              ),
            ],
          ),
        ),
      ),
  );
  server.registerTool(
    "list_insights",
    {
      title: "Browse saved charts",
      description:
        "Lists the charts the team has saved, with favorites marked. Use it to find out which metrics the team already cares about and how they name them, then open one with get_insight.",
      inputSchema: projectInput,
      annotations: readOnly,
    },
    async ({ project }) =>
      text(
        listInsights(await requireProject(project)).map((insight) => ({
          id: insight.id,
          name: insight.name ?? null,
          type: insight.type,
          favorite: insight.favorite,
          updatedAt: insight.updatedAt ?? null,
        })),
      ),
  );
  server.registerTool(
    "get_insight",
    {
      title: "Open a saved chart",
      description:
        "Shows exactly what a saved chart measures: which events, filters, breakdowns and time range. Use it to explain a chart, or as the definition to follow when reproducing or extending its numbers in SQL so your results match what the team sees.",
      inputSchema: { ...projectInput, id: z.number().int().positive() },
      annotations: readOnly,
    },
    async ({ project, id }) =>
      text(getInsight(await requireProject(project), id)),
  );
  server.registerTool(
    "list_dashboards",
    {
      title: "Browse dashboards",
      description:
        "Lists the team's dashboards and the charts on each, including the home dashboard. Use it to see how metrics are grouped, e.g. to find all charts about onboarding or revenue, and to pick charts to open with get_insight.",
      inputSchema: projectInput,
      annotations: readOnly,
    },
    async ({ project }) =>
      text(
        listDashboards(await requireProject(project)).map((dashboard) => ({
          id: dashboard.id,
          name: dashboard.name,
          home: dashboard.home,
          favorite: dashboard.favorite,
          insights: dashboard.insights.map((insight) => ({
            id: insight.id,
            name: insight.name ?? null,
            type: insight.type,
          })),
        })),
      ),
  );
  server.registerTool(
    "get_query_guide",
    {
      title: "Read the query guide",
      description:
        "Step-by-step help and ready-made example queries for common analyses: active users, top pages, funnels and retention. Read it before your first query, when a query fails, or when working with large amounts of data.",
      annotations: readOnly,
    },
    () => text(queryGuide),
  );
  return server;
}

// A JSON-RPC error body, as MCP clients expect from the endpoint.
const rpcError = (status: number, message: string, headers?: HeadersInit) =>
  Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message }, id: null },
    { status, ...(headers ? { headers } : {}) },
  );

/**
 * Admits requests that carry an active access token for this server. Failures
 * become RFC 9728 challenges whose resource_metadata points agents to sign-in.
 */
async function authorize(request: Request, resource: string) {
  try {
    await auth.api.authorizeMcpRequest({
      body: {
        authorization: request.headers.get("authorization"),
        dpop: request.headers.get("dpop"),
        method: request.method,
      },
    });
    return undefined;
  } catch (error) {
    const challenge = createResourceServerChallenge(error, resource, {
      challengeScopes: MCP_SCOPES,
    });
    if (!challenge) throw error;
    return rpcError(
      challenge.statusCode,
      challenge.message || "The access token is invalid or has expired",
      challenge.headers,
    );
  }
}

/** Stateless Streamable HTTP: every POST carries complete JSON-RPC messages. */
export async function handleMcp(request: Request): Promise<Response> {
  if (!mcpResource)
    return rpcError(
      503,
      "Agent access needs APP_ORIGIN to use HTTPS, or a loopback host",
    );
  const denied = await authorize(request, mcpResource);
  if (denied) return denied;
  // The gateway buffers responses, so no server-initiated stream is offered.
  if (request.method !== "POST")
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: { Allow: "POST" } },
    );
  const server = createServer();
  // Omitting sessionIdGenerator selects stateless mode.
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}
