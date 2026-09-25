import { z } from "zod";
import { orbitInsights } from "@quacklytics/contracts/orbit";
import {
  insight,
  dashboard,
  parseJson,
  defaultInsights,
  type Insight,
  type InsightInput,
} from "@quacklytics/contracts";
import { appDb, projectDatabase, setting, setSetting } from "./db/database";
import type { Database } from "bun:sqlite";
import { RequestError } from "./ingestion/process";
const projectRow = z.object({ id: z.string(), name: z.string() });
export function listProjects() {
  return z
    .array(projectRow)
    .parse(
      appDb.query("SELECT id,name FROM projects WHERE state='ready'").all(),
    )
    .map((row) => {
      const db = projectDatabase(row.id);
      return {
        ...row,
        partition: "month",
        corsOrigins: z
          .array(z.string())
          .parse(parseJson(setting(db, "cors_origins"))),
      };
    });
}
export function createProject(name: string) {
  const id = crypto.randomUUID();
  appDb
    .query("INSERT INTO projects(id,name,state) VALUES(?,?,'provisioning')")
    .run(id, name);
  const db = projectDatabase(id);
  createTemplate(db, "web_analytics", true);
  appDb.query("UPDATE projects SET state='ready' WHERE id=?").run(id);
  const result = listProjects().find((p) => p.id === id);
  if (!result) throw new Error("Project creation failed");
  return result;
}
export function requireProject(id: string) {
  if (
    !appDb.query("SELECT id FROM projects WHERE id=? AND state='ready'").get(id)
  )
    throw new RequestError(404, "Project not found");
  return projectDatabase(id);
}
const jsonRow = z.object({ id: z.number(), json: z.string() });
export function listInsights(db: Database) {
  return z
    .array(jsonRow)
    .parse(db.query("SELECT * FROM insights").all())
    .map((row) =>
      insight.parse({
        ...z.record(z.string(), z.unknown()).parse(parseJson(row.json)),
        id: row.id,
      }),
    );
}
export function saveInsight(db: Database, input: unknown, id?: number) {
  const value = insight.parse({
    ...z.record(z.string(), z.unknown()).parse(input),
    id: id ?? 1,
  });
  if (id) {
    if (!db.query("SELECT id FROM insights WHERE id=?").get(id))
      throw new RequestError(404, "Insight not found");
    db.query("UPDATE insights SET json=? WHERE id=?").run(
      JSON.stringify(value),
      id,
    );
    return value;
  }
  const result = db
    .query("INSERT INTO insights(json) VALUES(?)")
    .run(JSON.stringify(value));
  return { ...value, id: Number(result.lastInsertRowid) };
}
export function listDashboards(db: Database) {
  const insights = listInsights(db);
  return z
    .array(jsonRow)
    .parse(db.query("SELECT * FROM dashboards").all())
    .map((row) => {
      const value = dashboard.parse({
        ...z.record(z.string(), z.unknown()).parse(parseJson(row.json)),
        id: row.id,
      });
      return {
        ...value,
        insights: value.insights.flatMap((i) => {
          const current = insights.find((item) => item.id === i.id);
          return current ? [current] : [];
        }),
      };
    });
}
export function saveDashboard(db: Database, input: unknown, id?: number) {
  const value = dashboard.parse({
    ...z.record(z.string(), z.unknown()).parse(input),
    id: id ?? 1,
  });
  if (id) {
    if (!db.query("SELECT id FROM dashboards WHERE id=?").get(id))
      throw new RequestError(404, "Dashboard not found");
    db.query("UPDATE dashboards SET json=? WHERE id=?").run(
      JSON.stringify(value),
      id,
    );
    return value;
  }
  return {
    ...value,
    id: Number(
      db
        .query("INSERT INTO dashboards(json) VALUES(?)")
        .run(JSON.stringify(value)).lastInsertRowid,
    ),
  };
}
export function createTemplate(
  db: Database,
  template: string,
  home = false,
  name?: string,
  target?: number,
) {
  // Read at runtime: Bun build can inline process.env.NODE_ENV as development.
  if (template === "chart_playground" && Bun.env.NODE_ENV !== "development")
    throw new RequestError(404, "Template not available");
  if (
    !["web_analytics", "product_analytics", "chart_playground"].includes(
      template,
    )
  )
    throw new RequestError(400, "Unknown template");
  return db.transaction(() => {
    const existing = target
      ? listDashboards(db).find((d) => d.id === target)
      : undefined;
    if (target && !existing) throw new RequestError(404, "Dashboard not found");
    if (existing?.insights.length)
      throw new RequestError(409, "Template requires an empty dashboard");
    const seeds: InsightInput[] =
      template === "chart_playground"
        ? orbitInsights(365)
        : [
            { ...defaultInsights.Trend, name: "Events over time" },
            { ...defaultInsights.Value, name: "Total events" },
            { ...defaultInsights.Breakdown, name: "Event breakdown" },
            ...(template === "product_analytics"
              ? [
                  { ...defaultInsights.Retention, name: "Retention" },
                  { ...defaultInsights.Path, name: "User paths" },
                ]
              : []),
          ];
    const insights: Insight[] = seeds.map((seed) => saveInsight(db, seed));
    if (home)
      for (const d of listDashboards(db))
        saveDashboard(db, { ...d, home: false }, d.id);
    return saveDashboard(
      db,
      {
        name:
          name ??
          existing?.name ??
          (template === "chart_playground"
            ? "Chart playground (dev)"
            : template === "web_analytics"
              ? "Web Analytics Overview"
              : "Product Analytics Overview"),
        home: existing?.home ?? home,
        favorite: home,
        insights,
      },
      target,
    );
  })();
}
export function updateSettings(id: string, input: unknown) {
  const db = requireProject(id);
  const updates = z
    .array(
      z.object({
        key: z.enum(["name", "cors_origins"]),
        value: z.string(),
      }),
    )
    .parse(input);
  for (const update of updates) {
    if (update.key === "name") {
      appDb
        .query("UPDATE projects SET name=? WHERE id=?")
        .run(z.string().min(1).max(200).parse(update.value), id);
    } else {
      const origins = update.value.trim().startsWith("[")
        ? z.array(z.string()).parse(parseJson(update.value))
        : update.value
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean);
      for (const origin of origins) {
        if (origin !== "*" && new URL(origin).origin !== origin)
          throw new RequestError(
            400,
            "Origins must contain only scheme and host",
          );
      }
      setSetting(db, "cors_origins", JSON.stringify(origins));
    }
  }
  return listProjects();
}

export function recoverProjects() {
  for (const row of z
    .array(projectRow)
    .parse(
      appDb
        .query("SELECT id,name FROM projects WHERE state='provisioning'")
        .all(),
    )) {
    const db = projectDatabase(row.id);
    if (!listDashboards(db).length) createTemplate(db, "web_analytics", true);
    appDb.query("UPDATE projects SET state='ready' WHERE id=?").run(row.id);
  }
}
