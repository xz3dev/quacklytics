import { ingestionRetryAfter } from "./ingestion/rate-limit";
import { z } from "zod";
import { auth, authReady } from "./auth";
import { appDb, setting } from "./db/database";
import {
  listProjects,
  createProject,
  requireProject,
  updateSettings,
} from "./domain/projects";
import { processIngestion, hash } from "./ingestion/process";
import { anonymousVisitors } from "./ingestion/anonymous";
import { proxyCheck } from "./client-address";
import { geoipSource } from "./geoip";
import {
  recordIngest,
  recordInvalidKey,
  recordRejectedOrigin,
} from "./ingestion/diagnostics";
import { projectSetup } from "./domain/setup";
import { RequestError } from "./errors";
import { requestExport } from "./exports/client";
import { parseJson, projectEmoji } from "@quacklytics/contracts";

import { json, body } from "./handlers/shared";
import { apikeysHandler } from "./handlers/apikeys";
import { insightsHandler } from "./handlers/insights";
import { dashboardsHandler } from "./handlers/dashboards";
import { schemaHandler } from "./handlers/schema";
import { eventsHandler } from "./handlers/events";
import { mcpTokensHandler } from "./handlers/mcp-tokens";
import { handleMcp } from "./mcp/server";
const proxyCheckFor = (request: Request) =>
  proxyCheck({
    socket: request.headers.get("x-quacklytics-socket-ip") ?? "",
    forwardedFor: request.headers.get("x-forwarded-for"),
    host: request.headers.get("host"),
  });
export async function handleApi(request: Request): Promise<Response> {
  let ingestionOrigin: string | null = null;
  try {
    await authReady;
    const url = new URL(request.url);
    const segments = url.pathname.replace(/^\/api\/?/, "").split("/");
    const [projectId, resource, idText, action] = segments;
    if (url.pathname.startsWith("/api/auth/")) return auth.handler(request);
    if (projectId === "setup")
      return json({
        adminRegistered: !!appDb.query("SELECT id FROM user LIMIT 1").get(),
        geoip: geoipSource(),
      });
    if (projectId === "health") return json({ ok: true });
    // Agents authenticate with a user's bearer token instead of a session.
    if (projectId === "mcp" && !resource) return await handleMcp(request);
    // Backfill shares ingestion's key, CORS and rate limits, but may write into
    // archived months and responds only after they are merged into S3.
    if (projectId === "ingest" || projectId === "backfill") {
      if (request.method === "OPTIONS") {
        const origin = request.headers.get("origin") ?? "";
        if (
          !(await listProjects()).some(
            (project) =>
              project.corsOrigins.includes(origin) ||
              project.corsOrigins.includes("*"),
          )
        ) {
          recordRejectedOrigin(origin, null);
          throw new RequestError(403, "Origin not allowed");
        }
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            Vary: "Origin",
            "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          },
        });
      }

      const key = request.headers.get("x-api-key") ?? "";
      const record = z
        .object({ project: z.string() })
        .nullable()
        .parse(
          appDb
            .query("SELECT project FROM api_keys WHERE digest=?")
            .get(hash(key)),
        );
      if (!record) {
        recordInvalidKey();
        throw new RequestError(401, "Invalid ingestion key");
      }
      const db = await requireProject(record.project);
      const origin = request.headers.get("origin");
      const origins = z
        .array(z.string())
        .parse(parseJson(setting(db, "cors_origins")));
      if (origin && !origins.includes("*") && !origins.includes(origin)) {
        recordRejectedOrigin(origin, record.project);
        throw new RequestError(403, "Origin not allowed");
      }
      ingestionOrigin = origin;
      const cors = new Headers({ Vary: "Origin" });
      if (origin) cors.set("Access-Control-Allow-Origin", origin);
      if (request.method !== "POST")
        throw new RequestError(405, "Method not allowed");
      cors.set("Access-Control-Expose-Headers", "Retry-After");
      const retryAfter = ingestionRetryAfter(record.project);
      if (retryAfter !== undefined) {
        cors.set("Retry-After", String(retryAfter));
        return Response.json(
          { error: "Project ingestion rate exceeded" },
          { status: 429, headers: cors },
        );
      }
      const backfill = projectId === "backfill";
      const input = await body(request);
      const result = processIngestion(db, input, {
        backfill,
        // Backfilled events come from an importer, not the visitor.
        country: backfill
          ? undefined
          : (request.headers.get("x-quacklytics-country") ?? undefined),
        visitors: () =>
          anonymousVisitors(
            record.project,
            request.headers.get("x-quacklytics-client-ip") ?? "",
            request.headers.get("user-agent") ?? "",
          ),
      });
      // Committed rows are durable; on failure, retrying the same request ID
      // replays the acknowledgment and requests the merge again.
      recordIngest(record.project, {
        receivedAt: Date.now(),
        origin,
        client:
          typeof input === "object" &&
          input !== null &&
          "protocolVersion" in input
            ? "sdk"
            : "http",
        committed: result.committed,
        duplicates: result.duplicates,
        rejected: result.rejected,
        proxy: proxyCheckFor(request),
      });
      if (backfill) await requestExport(record.project);
      const response = json(result);
      for (const [key, value] of cors) response.headers.set(key, value);
      return response;
    }
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new RequestError(401, "Authentication required");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.get("origin");
      if (
        origin &&
        origin !== new URL(process.env.APP_ORIGIN ?? request.url).origin
      )
        throw new RequestError(403, "Origin not allowed");
    }
    if (projectId === "proxy-check") return json(proxyCheckFor(request));
    if (projectId === "me")
      return json({ id: session.user.id, email: session.user.email });
    if (projectId === "mcptokens")
      return mcpTokensHandler(request, session.user.id, resource);
    if (projectId === "projects") {
      if (request.method === "GET") return json(await listProjects());
      if (request.method === "POST")
        return json(
          await createProject(
            z
              .object({
                name: z.string().trim().min(1).max(200),
                emoji: projectEmoji.default(""),
              })
              .parse(await body(request)),
          ),
        );
    }
    if (!projectId) throw new RequestError(404, "Route not found");
    const db = await requireProject(projectId);
    const id = idText && /^\d+$/.test(idText) ? Number(idText) : undefined;
    if (
      ["schema", "events"].includes(resource ?? "") &&
      request.method !== "GET" &&
      !(
        resource === "events" &&
        idText === "catalog" &&
        action === "gen" &&
        request.method === "POST"
      )
    )
      throw new RequestError(405, "Method not allowed");
    if (
      ["insights", "dashboards"].includes(resource ?? "") &&
      !["GET", "POST", "PUT", "DELETE"].includes(request.method)
    )
      throw new RequestError(405, "Method not allowed");
    if (
      resource === "apikeys" &&
      !["GET", "POST", "DELETE"].includes(request.method)
    )
      throw new RequestError(405, "Method not allowed");
    if (resource === "settings" && request.method === "POST")
      return json(await updateSettings(projectId, await body(request)));
    const context = {
      request,
      url,
      db,
      projectId,
      id,
      idText,
      action,
      segments,
    };
    if (resource === "setup" && request.method === "GET")
      return json(projectSetup(db, projectId));
    if (resource === "apikeys") return await apikeysHandler(context);
    if (resource === "insights") return await insightsHandler(context);
    if (resource === "dashboards") return await dashboardsHandler(context);
    if (resource === "schema") return await schemaHandler(context);
    if (resource === "events") return await eventsHandler(context);
    throw new RequestError(404, "Route not found");
  } catch (error) {
    const failure = (value: unknown, status: number) =>
      Response.json(value, {
        status,
        headers: ingestionOrigin
          ? { "Access-Control-Allow-Origin": ingestionOrigin, Vary: "Origin" }
          : {},
      });
    if (error instanceof SyntaxError)
      return failure({ error: "Malformed JSON" }, 400);
    if (error instanceof z.ZodError)
      return failure({ error: "Invalid input", issues: error.issues }, 400);
    if (error instanceof RequestError)
      return failure({ error: error.message }, error.status);
    console.error(error);
    return failure({ error: "Internal server error" }, 500);
  }
}
