import { z } from "zod";
import { auth, authReady } from "./auth";
import { readApiKeySecret, storeApiKeySecret } from "./api-key-secrets";
import { appDb, setting } from "./db/database";
import {
  listProjects,
  createProject,
  requireProject,
  listInsights,
  saveInsight,
  listDashboards,
  saveDashboard,
  createTemplate,
  updateSettings,
} from "./projects";
import { processIngestion, hash, RequestError } from "./ingestion/process";
import { dashboardLayout, parseJson, properties } from "@quacklytics/contracts";
import { exportProject, eventSelect } from "./exports/export";
const json = (value: unknown, status = 200) => Response.json(value, { status });
async function body(request: Request) {
  const text = await request.text();
  if (text.length > 2_000_000) throw new RequestError(413, "Request too large");
  return text ? parseJson(text) : {};
}
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
      });
    if (projectId === "health") return json({ ok: true });
    if (projectId === "ingest") {
      if (request.method === "OPTIONS") {
        const origin = request.headers.get("origin") ?? "";
        if (
          !listProjects().some(
            (project) =>
              project.corsOrigins.includes(origin) ||
              project.corsOrigins.includes("*"),
          )
        )
          throw new RequestError(403, "Origin not allowed");
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
      if (!record) throw new RequestError(401, "Invalid ingestion key");
      const db = requireProject(record.project);
      const origin = request.headers.get("origin");
      const origins = z
        .array(z.string())
        .parse(parseJson(setting(db, "cors_origins")));
      if (origin && !origins.includes("*") && !origins.includes(origin))
        throw new RequestError(403, "Origin not allowed");
      ingestionOrigin = origin;
      const cors = new Headers({ Vary: "Origin" });
      if (origin) cors.set("Access-Control-Allow-Origin", origin);
      if (request.method !== "POST")
        throw new RequestError(405, "Method not allowed");
      const response = json(processIngestion(db, await body(request)));
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
    if (projectId === "me")
      return json({ id: session.user.id, email: session.user.email });
    if (projectId === "projects") {
      if (request.method === "GET") return json(listProjects());
      if (request.method === "POST")
        return json(
          createProject(
            z
              .object({ name: z.string().min(1).max(200) })
              .parse(await body(request)).name,
          ),
        );
    }
    if (!projectId) throw new RequestError(404, "Route not found");
    const db = requireProject(projectId);
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
      return json(updateSettings(projectId, await body(request)));
    if (resource === "apikeys") {
      if (request.method === "DELETE") {
        appDb
          .query("DELETE FROM api_keys WHERE id=? AND project=?")
          .run(id ?? 0, projectId);
        return json(null);
      }
      let secret: string | undefined, created: number | undefined;
      if (request.method === "POST") {
        const newSecret = crypto.randomUUID() + crypto.randomUUID();
        secret = newSecret;
        created = appDb.transaction(() => {
          const keyId = Number(
            appDb
              .query(
                "INSERT INTO api_keys(project,digest,prefix,created_at) VALUES(?,?,?,?)",
              )
              .run(
                projectId,
                hash(newSecret),
                newSecret.slice(0, 8),
                Date.now(),
              ).lastInsertRowid,
          );
          storeApiKeySecret(keyId, newSecret);
          return keyId;
        })();
      }
      const rows = z
        .array(
          z.object({
            id: z.number(),
            project: z.string(),
            prefix: z.string(),
            created_at: z.number(),
          }),
        )
        .parse(
          appDb
            .query(
              "SELECT id,project,prefix,created_at FROM api_keys WHERE project=?",
            )
            .all(projectId),
        );
      const keys = rows.map((row) => ({
        id: row.id,
        project: row.project,
        createdAt: row.created_at,
        key: row.id === created ? secret : row.prefix + "…",
      }));
      if (id) {
        const key = keys.find((key) => key.id === id);
        if (!key) throw new RequestError(404, "ingestion key not found");
        const fullKey = readApiKeySecret(key.id);
        if (!fullKey)
          throw new RequestError(
            409,
            "This older key cannot be recovered. Create a new ingestion key to copy its full value.",
          );
        return json({ ...key, key: fullKey });
      }
      return json(keys);
    }
    if (resource === "insights") {
      if (request.method === "GET") {
        const items = listInsights(db);
        return json(id ? (items.find((i) => i.id === id) ?? null) : items);
      }
      if (request.method === "DELETE") {
        db.query("DELETE FROM insights WHERE id=?").run(id ?? 0);
        return json(null);
      }
      return json(saveInsight(db, await body(request), id));
    }
    if (resource === "dashboards") {
      if (request.method === "GET") {
        const items = listDashboards(db);
        return json(id ? (items.find((d) => d.id === id) ?? null) : items);
      }
      if (request.method === "DELETE") {
        db.query("DELETE FROM dashboards WHERE id=?").run(id ?? 0);
        return json(null);
      }
      if (idText === "default") {
        if (listDashboards(db).length)
          throw new RequestError(409, "Dashboards already exist");
        return json(createTemplate(db, "web_analytics", true));
      }
      if (idText === "templates" || action === "templates") {
        const input = z
          .object({ name: z.string().optional(), home: z.boolean().optional() })
          .parse(await body(request));
        return json(
          createTemplate(
            db,
            idText === "templates" ? (action ?? "") : (segments[4] ?? ""),
            input.home ?? false,
            input.name,
            idText === "templates" ? undefined : id,
          ),
        );
      }
      if (action === "layout" && request.method === "PUT") {
        const { layout } = z
          .object({ layout: dashboardLayout })
          .parse(await body(request));
        const existing = listDashboards(db).find((d) => d.id === id);
        if (!existing) throw new RequestError(404, "Dashboard not found");
        if (
          layout.length !== existing.insights.length ||
          layout.some(
            (item) =>
              !existing.insights.some(
                (insight) => insight.id === item.insightId,
              ),
          )
        ) {
          throw new RequestError(
            409,
            "Dashboard insights changed. Reload before adjusting the layout.",
          );
        }
        return json(saveDashboard(db, { ...existing, layout }, id));
      }
      if (action === "insights" || action === "home") {
        const existing = listDashboards(db).find((d) => d.id === id);
        if (!existing) throw new RequestError(404, "Dashboard not found");
        if (action === "home") {
          db.transaction(() => {
            for (const d of listDashboards(db))
              saveDashboard(db, { ...d, home: d.id === id }, d.id);
          })();
          return json({ ...existing, home: true });
        }
        const { insight_ids } = z
          .object({ insight_ids: z.array(z.number().int().positive()) })
          .parse(await body(request));
        const all = listInsights(db);
        return json(
          saveDashboard(
            db,
            {
              ...existing,
              layout: existing.layout?.filter((item) =>
                insight_ids.includes(item.insightId),
              ),
              insights: insight_ids.map((i) => {
                const found = all.find((item) => item.id === i);
                if (!found) throw new RequestError(400, "Unknown insight");
                return found;
              }),
            },
            id,
          ),
        );
      }
      const input = z
        .record(z.string(), z.unknown())
        .parse(await body(request));
      return json(
        saveDashboard(
          db,
          { favorite: false, home: false, insights: [], ...input },
          id,
        ),
      );
    }
    if (resource === "schema") {
      if (idText === "prop") {
        return json(
          z
            .array(z.object({ value: z.string() }))
            .parse(
              db
                .query("SELECT value FROM schema_values WHERE property_id=?")
                .all(Number(action)),
            )
            .map((r) => r.value),
        );
      }
      const result: Record<
        string,
        Record<string, { id: number; type: string }>
      > = {};
      for (const row of z
        .array(z.object({ event_type: z.string() }))
        .parse(db.query("SELECT DISTINCT event_type FROM events").all()))
        result[row.event_type] = {};
      for (const row of z
        .array(
          z.object({
            id: z.number(),
            event_type: z.string(),
            name: z.string(),
            type: z.string(),
          }),
        )
        .parse(db.query("SELECT * FROM schemas").all())) {
        const fields = result[row.event_type] ?? {};
        fields[row.name] = { id: row.id, type: row.type };
        result[row.event_type] = fields;
      }
      return json(result);
    }
    if (resource === "events") {
      if (idText === "catalog") {
        if (action === "gen") {
          if (request.method !== "POST")
            throw new RequestError(405, "Use POST");
          return json(await exportProject(db, projectId));
        }
        return json(await exportProject(db, projectId));
      }
      if (idText) throw new RequestError(404, "Unknown event resource");
      const since = url.searchParams.get("timestamp__gt");
      const timestamp = since ? Date.parse(since) : -8640000000000000;
      if (!Number.isFinite(timestamp))
        throw new RequestError(400, "Invalid timestamp");
      const rows = z
        .array(
          z.object({
            id: z.string(),
            timestamp: z.number(),
            event_type: z.string(),
            session_id: z.string().nullable(),
            person_id: z.string().nullable(),
            properties: z.string(),
          }),
        )
        .parse(
          db
            .query(
              eventSelect +
                " WHERE e.timestamp>? ORDER BY e.timestamp,e.id LIMIT 10000",
            )
            .all(timestamp),
        );
      return json(
        rows.map((r) => ({
          id: r.id,
          timestamp: new Date(r.timestamp).toISOString(),
          eventType: r.event_type,
          sessionId: r.session_id,
          personId: r.person_id,
          properties: properties.parse(parseJson(r.properties)),
          personProperties: {},
        })),
      );
    }
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
