import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Database } from "bun:sqlite";
import { z } from "zod";
import { requireProject } from "../domain/projects";
import { getInsight, listInsights } from "../domain/insights";
import { listDashboards } from "../domain/dashboards";
import { mcpTokenProject } from "../domain/mcp-tokens";
import { readSchema } from "../domain/schema";
import { requestDataset } from "../exports/client";
import { instructions, queryGuide } from "./guide";

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

function createServer(db: Database, project: string) {
  const server = new McpServer(
    { name: "quacklytics", title: "Quacklytics", version: "1.0.0" },
    { instructions },
  );
  server.registerTool(
    "get_dataset",
    {
      title: "Load event data",
      description:
        "Start here to answer any question about how people use the product: traffic, signups, conversion, retention, feature usage or a specific user's activity. Returns everything needed to query all of the project's events yourself; run its setupSql in DuckDB, then write SQL against `events`. Use the data from one call together, and call again when you need fresher data or the links stop working.",
      annotations: readOnly,
    },
    async () => text(await requestDataset(project)),
  );
  server.registerTool(
    "get_schema",
    {
      title: "See what is tracked",
      description:
        "Lists every kind of event the product records and the details captured with each. Use it before writing a query to find the right event names and properties, e.g. which event marks a purchase and where the plan or amount is stored.",
      annotations: readOnly,
    },
    () =>
      text(
        Object.fromEntries(
          Object.entries(readSchema(db)).map(([eventType, fields]) => [
            eventType,
            Object.fromEntries(
              Object.entries(fields).map(([name, field]) => [name, field.type]),
            ),
          ]),
        ),
      ),
  );
  server.registerTool(
    "list_insights",
    {
      title: "Browse saved charts",
      description:
        "Lists the charts the team has saved, with favorites marked. Use it to find out which metrics the team already cares about and how they name them, then open one with get_insight.",
      annotations: readOnly,
    },
    () =>
      text(
        listInsights(db).map((insight) => ({
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
      inputSchema: { id: z.number().int().positive() },
      annotations: readOnly,
    },
    // Thrown errors such as an unknown id become isError results for the model.
    ({ id }) => text(getInsight(db, id)),
  );
  server.registerTool(
    "list_dashboards",
    {
      title: "Browse dashboards",
      description:
        "Lists the team's dashboards and the charts on each, including the home dashboard. Use it to see how metrics are grouped, e.g. to find all charts about onboarding or revenue, and to pick charts to open with get_insight.",
      annotations: readOnly,
    },
    () =>
      text(
        listDashboards(db).map((dashboard) => ({
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

const unauthorized = (message: string) =>
  Response.json(
    { error: message },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="quacklytics"' },
    },
  );

/** Stateless Streamable HTTP: every POST carries complete JSON-RPC messages. */
export async function handleMcp(request: Request): Promise<Response> {
  const token = /^Bearer\s+(\S+)$/i.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (!token) return unauthorized("MCP access token required");
  const project = mcpTokenProject(token);
  if (!project) return unauthorized("Invalid MCP access token");
  // The gateway buffers responses, so no server-initiated stream is offered.
  if (request.method !== "POST")
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: { Allow: "POST" } },
    );
  const server = createServer(await requireProject(project), project);
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
